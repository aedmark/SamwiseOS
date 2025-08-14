# gem/core/executor.py

import shlex
import json
from importlib import import_module
from filesystem import fs_manager
from users import user_manager
from groups import group_manager
import inspect
import os
import re
import fnmatch
import asyncio
import traceback

class CommandExecutor:
    def __init__(self):
        self.fs_manager = fs_manager
        self.commands = self._discover_commands()
        self.user_context = {"name": "Guest"}
        self._flag_def_cache = {}
        self.ai_manager = None

    def set_ai_manager(self, ai_manager_instance):
        self.ai_manager = ai_manager_instance

    def _discover_commands(self):
        try:
            command_dir = '/core/commands'
            py_files = [f for f in os.listdir(command_dir) if f.endswith('.py') and not f.startswith('__')]
            return sorted([os.path.splitext(f)[0] for f in py_files])
        except FileNotFoundError:
            local_command_dir = os.path.join(os.path.dirname(__file__), 'commands')
            if os.path.exists(local_command_dir):
                py_files = [f for f in os.listdir(local_command_dir) if f.endswith('.py') and not f.startswith('__')]
                return sorted([os.path.splitext(f)[0] for f in py_files])
            return []

    def set_context(self, user_context, users, user_groups, config, groups, jobs, api_key, session_start_time, session_stack):
        self.user_context = user_context if user_context else {"name": "Guest"}
        self.users = users if users else {}
        self.user_groups = user_groups if user_groups else {}
        self.config = config if config else {}
        self.groups = groups if groups else {}
        self.jobs = jobs if jobs else {}
        self.api_key = api_key
        self.session_start_time = session_start_time
        self.session_stack = session_stack

    def _get_command_flag_definitions(self, command_name):
        if command_name in self._flag_def_cache:
            return self._flag_def_cache[command_name]
        try:
            command_module = import_module(f"commands.{command_name}")
            define_func = getattr(command_module, 'define_flags', None)
            if define_func and callable(define_func):
                definitions = define_func()
                self._flag_def_cache[command_name] = definitions
                return definitions
        except ImportError:
            pass
        self._flag_def_cache[command_name] = []
        return []

    def _parts_to_segment(self, segment_parts):
        if not segment_parts:
            return None
        command_name = segment_parts[0]
        raw_args_and_flags = segment_parts[1:]
        expanded_parts = []
        for part in raw_args_and_flags:
            if '*' in part or '?' in part or ('[' in part and ']' in part):
                path_prefix, pattern_part = os.path.split(part)
                if not path_prefix: path_prefix = '.'
                search_dir_abs = self.fs_manager.get_absolute_path(path_prefix)
                dir_node = self.fs_manager.get_node(search_dir_abs)
                if dir_node and dir_node.get('type') == 'directory':
                    children_names = dir_node.get('children', {}).keys()
                    matches = fnmatch.filter(children_names, pattern_part)
                    if matches:
                        for name in sorted(matches):
                            expanded_parts.append(os.path.join(path_prefix, name) if path_prefix != '.' else name)
                    else:
                        expanded_parts.append(part)
                else:
                    expanded_parts.append(part)
            else:
                expanded_parts.append(part)
        parts_to_process = [command_name] + expanded_parts
        args, flags, flag_definitions = [], {}, self._get_command_flag_definitions(command_name)
        flag_map = {}
        for flag_def in flag_definitions:
            canonical_name, takes_value = flag_def['name'], flag_def.get('takes_value', False)
            if 'short' in flag_def: flag_map[f"-{flag_def['short']}"] = (canonical_name, takes_value)
            if 'long' in flag_def: flag_map[f"--{flag_def['long']}"] = (canonical_name, takes_value)
        i = 1
        while i < len(parts_to_process):
            part = parts_to_process[i]
            if part in flag_map:
                canonical_name, takes_value = flag_map[part]
                if takes_value:
                    if i + 1 < len(parts_to_process) and not parts_to_process[i+1].startswith('-'):
                        flags[canonical_name] = parts_to_process[i+1]
                        i += 2
                    else: raise ValueError(f"Flag '{part}' requires an argument.")
                else:
                    flags[canonical_name] = True
                    i += 1
            elif part.startswith('-') and not part.startswith('--') and len(part) > 2:
                all_valid, temp_flags = True, {}
                for char in part[1:]:
                    char_flag = f'-{char}'
                    if char_flag in flag_map and not flag_map[char_flag][1]:
                        temp_flags[flag_map[char_flag][0]] = True
                    else:
                        all_valid = False
                        break
                if all_valid:
                    flags.update(temp_flags)
                    i += 1
                else:
                    args.append(part)
                    i += 1
            else:
                args.append(part)
                i += 1
        return {'command': command_name, 'args': args, 'flags': flags}

    def _parse_command_string(self, command_string):
        try:
            command_string = command_string.replace(';', ' ; ').replace('&&', ' && ').replace('||', ' || ').replace('|', ' | ')
            parts = shlex.split(command_string)
        except ValueError as e:
            raise ValueError(f"Syntax error in command: {e}")
        if not parts: return []
        command_sequence, sub_commands, last_op_index = [], [], 0
        for i, part in enumerate(parts):
            if part in ['&&', '||', ';']:
                sub_commands.append({'command_parts': parts[last_op_index:i], 'operator': part})
                last_op_index = i + 1
        sub_commands.append({'command_parts': parts[last_op_index:], 'operator': None})
        for sub_cmd in sub_commands:
            command_parts = sub_cmd['command_parts']
            if not command_parts:
                if sub_cmd['operator']: raise ValueError(f"Syntax error: missing command before '{sub_cmd['operator']}'")
                continue
            redirection, i = None, 0
            while i < len(command_parts):
                part = command_parts[i]
                if part in ['>', '>>', '<']:
                    if i + 1 >= len(command_parts): raise ValueError(f"Syntax error: no file for redirection operator '{part}'.")
                    filename = command_parts[i+1]
                    if part != '<': redirection = {'type': 'append' if part == '>>' else 'overwrite', 'file': filename}
                    command_parts.pop(i)
                    command_parts.pop(i)
                    continue
                i += 1
            segments, current_segment_parts = [], []
            for part in command_parts:
                if part == '|':
                    segment = self._parts_to_segment(current_segment_parts)
                    if not segment: raise ValueError("Syntax error: invalid null command.")
                    segments.append(segment)
                    current_segment_parts = []
                else:
                    current_segment_parts.append(part)
            final_segment = self._parts_to_segment(current_segment_parts)
            if final_segment: segments.append(final_segment)
            if segments: command_sequence.append({'segments': segments, 'operator': sub_cmd['operator'], 'redirection': redirection})
        return command_sequence

    async def _preprocess_command_string(self, command_string, js_context_json):
        pattern = re.compile(r'\$\((.*?)\)', re.DOTALL)
        match = pattern.search(command_string)
        while match:
            sub_command = match.group(1)
            sub_result_json = await self.execute(sub_command, js_context_json)
            sub_result = json.loads(sub_result_json)
            if sub_result.get("success"):
                output = sub_result.get("output", "").strip().replace('\n', ' ')
                command_string = command_string[:match.start()] + output + command_string[match.end():]
            else:
                raise ValueError(f"Command substitution failed: {sub_result.get('error')}")
            match = pattern.search(command_string)
        return command_string

    async def execute(self, command_string, js_context_json, stdin_data=None):
        try:
            context = json.loads(js_context_json)
            if 'users' in context: user_manager.load_users(context['users'])
            if 'groups' in context: group_manager.load_groups(context['groups'])
            fs_manager.set_context(current_path=context.get("current_path", "/"), user_groups=context.get("user_groups"))
            self.set_context(
                user_context=context.get("user_context"), users=context.get("users"),
                user_groups=context.get("user_groups"), config=context.get("config"),
                groups=context.get("groups"), jobs=context.get("jobs"), api_key=context.get("api_key"),
                session_start_time=context.get("session_start_time"), session_stack=context.get("session_stack")
            )
            processed_command_string = await self._preprocess_command_string(command_string, js_context_json)
            command_sequence = self._parse_command_string(processed_command_string)
            if not command_sequence: return json.dumps({"success": True, "output": ""})
            last_result_obj = {"success": True, "output": ""}
            for pipeline in command_sequence:
                if pipeline['operator'] == '&&' and not last_result_obj.get("success"): continue
                if pipeline['operator'] == '||' and last_result_obj.get("success"): continue
                pipeline_input = stdin_data
                for i, segment in enumerate(pipeline['segments']):
                    result_or_promise = await self._execute_segment(segment, pipeline_input)
                    result_json = result_or_promise
                    last_result_obj = json.loads(result_json)
                    if not last_result_obj.get("success"): break
                    pipeline_input = last_result_obj.get("output")
                if last_result_obj.get("success") and pipeline['redirection']:
                    file_path = pipeline['redirection']['file']
                    content_to_write = last_result_obj.get("output", "")
                    if pipeline['redirection']['type'] == 'append':
                        try:
                            existing_node = self.fs_manager.get_node(file_path)
                            if existing_node: content_to_write = existing_node.get('content', '') + "\n" + content_to_write
                        except FileNotFoundError: pass
                    self.fs_manager.write_file(file_path, content_to_write, self.user_context)
                    last_result_obj['output'] = ""
            return json.dumps(last_result_obj)
        except Exception as e:
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"Execution Error: {str(e)}\n{tb_str}"})

    async def _execute_segment(self, segment, stdin_data):
        result = await self.run_command_by_name(
            command_name=segment['command'], args=segment['args'], flags=segment['flags'],
            user_context=self.user_context, stdin_data=stdin_data, kwargs={}
        )
        return result

    async def run_command_by_name(self, command_name, args, flags, user_context, stdin_data, kwargs, js_context_json=None):
        if js_context_json:
            context = json.loads(js_context_json)
            fs_manager.set_context(current_path=context.get("current_path", "/"), user_groups=context.get("user_groups"))
            self.set_context(
                user_context=context.get("user_context"), users=context.get("users"), user_groups=context.get("user_groups"),
                config=context.get("config"), groups=context.get("groups"), jobs=context.get("jobs"),
                api_key=context.get("api_key"), session_start_time=context.get("session_start_time"),
                session_stack=context.get("session_stack")
            )
        if command_name not in self.commands:
            return json.dumps({"success": False, "error": f"{command_name}: command not found"})
        try:
            command_module = import_module(f"commands.{command_name}")
            run_func = getattr(command_module, 'run', None)
            if not run_func:
                return json.dumps({"success": False, "error": f"Command '{command_name}' is not runnable."})
            if inspect.iscoroutinefunction(run_func):
                result = await run_func(args=args, flags=flags, user_context=user_context, stdin_data=stdin_data, **kwargs)
                if isinstance(result, dict):
                    if 'success' not in result: result['success'] = True
                    return json.dumps(result)
                else:
                    return json.dumps({"success": True, "output": str(result)})
            else:
                possible_kwargs = {
                    "args": args, "flags": flags, "user_context": user_context, "stdin_data": stdin_data,
                    "users": self.users, "user_groups": self.user_groups, "config": self.config,
                    "groups": self.groups, "jobs": self.jobs, "ai_manager": self.ai_manager,
                    "api_key": self.api_key, "session_start_time": self.session_start_time,
                    "session_stack": self.session_stack, "commands": self.commands, **kwargs
                }
                sig = inspect.signature(run_func)
                params = sig.parameters
                has_varkw = any(p.kind == p.VAR_KEYWORD for p in params.values())
                kwargs_for_run = {k: v for k, v in possible_kwargs.items() if k in params} if not has_varkw else possible_kwargs
                result = run_func(**kwargs_for_run)
                if isinstance(result, dict):
                    if 'success' not in result: result['success'] = True
                    return json.dumps(result)
                else:
                    return json.dumps({"success": True, "output": str(result)})
        except Exception as e:
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"Error executing '{command_name}': {repr(e)}\n{tb_str}"})

command_executor = CommandExecutor()