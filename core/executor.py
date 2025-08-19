# gem/core/executor.py

import shlex
import json
from importlib import import_module
from filesystem import fs_manager
from users import user_manager
from groups import group_manager
from session import alias_manager, env_manager
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
        self.js_native_commands = set()

    def set_ai_manager(self, ai_manager_instance):
        self.ai_manager = ai_manager_instance

    def set_js_native_commands(self, command_list):
        self.js_native_commands = set(command_list)

    def _discover_commands(self):
        try:
            command_dir = '/core/commands'
            py_files = [f for f in os.listdir(command_dir) if f.endswith('.py') and not f.startswith('__')]
            return sorted([os.path.splitext(f)[0] for f in py_files])
        except FileNotFoundError:
            # Fallback for local development if /core isn't mounted in Pyodide
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
        self._flag_def_cache[command_name] = {}
        return {}

    def _parts_to_segment(self, segment_parts):
        if not segment_parts:
            return None

        command_name = segment_parts[0]
        raw_args_and_flags = segment_parts[1:]

        # Wildcard Expansion (Globbing)
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
                        expanded_parts.append(part) # No match, pass the glob pattern literally
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

            is_attached_value_flag = False
            if part.startswith('-') and not part.startswith('--') and len(part) > 2:
                short_flag = part[:2]
                if short_flag in flag_map and flag_map[short_flag][1]:
                    canonical_name, _ = flag_map[short_flag]
                    flags[canonical_name] = part[2:]
                    i += 1
                    is_attached_value_flag = True
                    continue

            if is_attached_value_flag: continue

            if part.startswith('--') and '=' in part:
                flag_name, flag_value = part.split('=', 1)
                if flag_name in flag_map and flag_map[flag_name][1]:
                    canonical_name, _ = flag_map[flag_name]
                    flags[canonical_name] = flag_value
                    i += 1
                    continue

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
            elif part.startswith('-') and not part.startswith('--') and len(part) > 2: # Combined short flags like -la
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

    def _expand_braces(self, segment):
        brace_match = re.search(r'\{([^}]+)\}', segment)
        if not brace_match:
            return [segment]

        prefix = segment[:brace_match.start()]
        suffix = segment[brace_match.end():]
        content = brace_match.group(1)

        if ',' in content:
            parts = content.split(',')
            return [f"{prefix}{part}{suffix}" for part in parts]
        elif '..' in content:
            range_parts = content.split('..')
            if len(range_parts) == 2:
                try:
                    start, end = int(range_parts[0]), int(range_parts[1])
                    step = 1 if start <= end else -1
                    return [f"{prefix}{i}{suffix}" for i in range(start, end + step, step)]
                except ValueError:
                    start_char, end_char = range_parts[0], range_parts[1]
                    if len(start_char) == 1 and len(end_char) == 1:
                        start_ord, end_ord = ord(start_char), ord(end_char)
                        step = 1 if start_ord <= end_ord else -1
                        return [f"{prefix}{chr(i)}{suffix}" for i in range(start_ord, end_ord + step, step)]
        return [segment]

    async def _preprocess_command_string(self, command_string, js_context_json):
        # Brace Expansion (quote-aware)
        if '{' in command_string and '}' in command_string:
            def _split_preserving_quotes(s):
                tokens, buf = [], []
                in_single, in_double = False, False
                i = 0
                while i < len(s):
                    ch = s[i]
                    if ch == "'" and not in_double:
                        in_single = not in_single
                        buf.append(ch)
                    elif ch == '"' and not in_single:
                        in_double = not in_double
                        buf.append(ch)
                    elif ch.isspace() and not in_single and not in_double:
                        if buf:
                            tokens.append(''.join(buf))
                            buf = []
                    else:
                        buf.append(ch)
                    i += 1
                if buf:
                    tokens.append(''.join(buf))
                return tokens
            expanded_parts = []
            for part in _split_preserving_quotes(command_string):
                is_quoted = (len(part) >= 2 and ((part[0] == part[-1] == "'") or (part[0] == part[-1] == '"')))
                if is_quoted:
                    # Do not expand braces inside quoted strings
                    expanded_parts.append(part)
                else:
                    expanded_parts.extend(self._expand_braces(part))
            command_string = ' '.join(expanded_parts)

        # Alias Resolution
        try:
            parts = shlex.split(command_string)
        except ValueError as e:
            if "No closing quotation" in str(e):
                raise ValueError("Syntax error: No closing quotation.")
            raise e
        if parts:
            command_name = parts[0]
            alias_value = alias_manager.get_alias(command_name)
            if alias_value:
                remaining_args = ' '.join(parts[1:])
                command_string = f"{alias_value} {remaining_args}".strip()

        # Environment Variable Expansion
        def replace_var(match):
            var_name = match.group(1) or match.group(2)
            return env_manager.get(var_name) or ""

        parts = command_string.split("'")
        result_parts = []
        for i, part in enumerate(parts):
            if i % 2 == 0:
                expanded_part = re.sub(r'\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}', replace_var, part)
                result_parts.append(expanded_part)
            else:
                result_parts.append(part)
        command_string = "'".join(result_parts)

        # Command Substitution
        pattern = re.compile(r'\$\((.*?)\)', re.DOTALL)
        match = pattern.search(command_string)
        while match:
            sub_command = match.group(1)
            sub_result_json = await self.execute(sub_command, js_context_json)
            sub_result = json.loads(sub_result_json)
            if sub_result.get("success"):
                # Shell-like behavior: strip trailing newlines; replace embedded newlines with spaces
                output = str(sub_result.get("output", ""))
                # Normalize Windows CRLF and Unix LF
                output = output.replace('\r\n', '\n').replace('\r', '\n')
                # Remove trailing newlines
                output = output.rstrip('\n')
                # Replace remaining newlines with spaces
                output = output.replace('\n', ' ')
                # If substitution occurs immediately after '=', treat as a single assignment value by quoting
                before_idx = match.start() - 1
                if before_idx >= 0 and command_string[before_idx] == '=':
                    # Escape any double quotes in the output
                    safe_output = output.replace('"', '\\"')
                    replacement = f'"{safe_output}"'
                else:
                    replacement = output
                command_string = command_string[:match.start()] + replacement + command_string[match.end():]
            else:
                raise ValueError(f"Command substitution failed: {sub_result.get('error')}")
            match = pattern.search(command_string)
        return command_string

    def _parse_command_string(self, command_string):
        # Use a negative lookbehind `(?<!\\)` to avoid splitting on escaped semicolons (`\;`),
        # while still respecting quoted strings. This is the key fix.
        commands_raw = re.split(r'''(?<!\\);(?=(?:[^'"]|'[^']*'|"[^"]*")*$)''', command_string)
        # After splitting, un-escape the semicolons that were intentionally kept.
        commands = [cmd.replace('\\;', ';') for cmd in commands_raw]

        command_sequence = []
        for command in commands:
            command = command.strip()
            if not command:
                continue

            try:
                parts = shlex.split(command)
            except ValueError as e:
                raise ValueError(f"Syntax error in command: '{command}' -> {e}")

            if not parts:
                continue

            sub_commands, last_op_index = [], 0
            for i, part in enumerate(parts):
                if part in ['&&', '||', '&']:
                    sub_commands.append({'command_parts': parts[last_op_index:i], 'operator': part})
                    last_op_index = i + 1

            # Only add the remaining parts if there are any.
            # This prevents an empty sub-command when the line ends with an operator.
            remaining_parts = parts[last_op_index:]
            if remaining_parts:
                sub_commands.append({'command_parts': remaining_parts, 'operator': None})

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

                is_background = sub_cmd['operator'] == '&'
                if segments or redirection:
                    command_sequence.append({'segments': segments, 'operator': sub_cmd['operator'], 'redirection': redirection, 'is_background': is_background})

        return command_sequence


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
            # Standalone variable assignment(s) handling (e.g., VAR=value [VAR2=value ...])
            try:
                assign_parts = shlex.split(processed_command_string)
            except ValueError as e:
                raise ValueError(f"Syntax error in command: {e}")
            def is_assignment_token(tok):
                return bool(re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', tok))
            if assign_parts and all(is_assignment_token(tok) for tok in assign_parts):
                for tok in assign_parts:
                    name, value = tok.split('=', 1)
                    env_manager.set(name, value)
                return json.dumps({"success": True, "output": ""})

            command_sequence = self._parse_command_string(processed_command_string)

            if not command_sequence: return json.dumps({"success": True, "output": ""})

            last_result_obj = {"success": True, "output": ""}
            collected_effects = []

            for pipeline in command_sequence:
                if pipeline.get('operator') == '&&' and not last_result_obj.get("success"): continue
                if pipeline.get('operator') == '||' and last_result_obj.get("success"): continue

                # If a command has both redirection AND is backgrounded, we treat it as a
                # synchronous file-writing operation, NOT a true background job.
                # This ensures the file exists before the next command in a script runs.
                is_synchronous_background_write = pipeline.get('is_background') and pipeline.get('redirection')
                if pipeline.get('is_background') and not is_synchronous_background_write:
                    # This block now ONLY handles TRUE background jobs (no redirection).
                    first_segment = pipeline['segments'][0] if pipeline.get('segments') else None
                    if not first_segment:
                        last_result_obj = {"success": False, "error": "Syntax error: invalid null command for background job."}
                        continue

                    command_parts = [first_segment['command']] + first_segment['args']
                    bg_result = {
                        "effect": 'background_job',
                        "command_string": " ".join(shlex.quote(p) for p in command_parts)
                    }
                    collected_effects.append(bg_result)
                    last_result_obj = {"success": True}
                    continue

                # Everything else (including our synchronous_background_write) is executed here.
                pipeline_input = stdin_data
                for i, segment in enumerate(pipeline['segments']):
                    result_or_promise = await self._execute_segment(segment, pipeline_input)
                    result_json = result_or_promise
                    last_result_obj = json.loads(result_json)

                    is_last_in_pipe = (i == len(pipeline['segments']) - 1)
                    if (last_result_obj.get('effect') == 'page_output' and not is_last_in_pipe):
                        # This is a pager, but its output is being piped. Act like `cat`.
                        # Overwrite the result object to just pass the content through.
                        last_result_obj = {
                            "success": True,
                            "output": last_result_obj.get("content", "")
                        }

                    if isinstance(last_result_obj, dict) and last_result_obj.get('effect'):
                        collected_effects.append(last_result_obj)
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

            if collected_effects:
                response_obj = {k: v for k, v in last_result_obj.items() if k != 'effect'}
                response_obj['effects'] = collected_effects
                return json.dumps(response_obj)

            return json.dumps(last_result_obj)
        except Exception as e:
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"Execution Error: {str(e)}\n{tb_str}"})

    async def _execute_segment(self, segment, stdin_data):
        command_name = segment['command']

        definitions = self._get_command_flag_definitions(command_name)
        metadata = definitions.get('metadata', {})
        if metadata.get('root_required') and self.user_context.get('name') != 'root':
            return json.dumps({"success": False, "error": f"{command_name}: permission denied. You must be root to run this command."})

        kwargs_for_run = {
            "users": self.users,
            "user_groups": self.user_groups,
            "config": self.config,
            "groups": self.groups,
            "jobs": self.jobs,
            "ai_manager": self.ai_manager,
            "api_key": self.api_key,
            "session_start_time": self.session_start_time,
            "session_stack": self.session_stack,
            "commands": self.commands
        }
        result = await self.run_command_by_name(
            command_name=command_name,
            args=segment['args'],
            flags=segment['flags'],
            user_context=self.user_context,
            stdin_data=stdin_data,
            kwargs=kwargs_for_run
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
            possible_kwargs = {
                "args": args, "flags": flags, "user_context": user_context, "stdin_data": stdin_data,
                **kwargs
            }
            sig = inspect.signature(run_func)
            params = sig.parameters
            has_varkw = any(p.kind == p.VAR_KEYWORD for p in params.values())
            kwargs_for_run = {k: v for k, v in possible_kwargs.items() if k in params} if not has_varkw else possible_kwargs

            if inspect.iscoroutinefunction(run_func):
                result = await run_func(**kwargs_for_run)
            else:
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