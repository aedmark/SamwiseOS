# /core/executor.py

import shlex
import json
from importlib import import_module
from filesystem import fs_manager
import inspect
import os
import re

class CommandExecutor:
    def __init__(self):
        self.fs_manager = fs_manager
        self.commands = self._discover_commands()
        self.user_context = {"name": "Guest"}

    def _discover_commands(self):
        """Dynamically finds all available command modules."""
        command_dir = os.path.join(os.path.dirname(__file__), 'commands')
        py_files = [f for f in os.listdir(command_dir) if f.endswith('.py') and not f.startswith('__')]
        return [os.path.splitext(f)[0] for f in py_files]

    def set_context(self, user_context, users, user_groups, config, groups, jobs, ai_manager, api_key, session_start_time, session_stack):
        """Sets the current user and system context from the JS side."""
        self.user_context = user_context if user_context else {"name": "Guest"}
        self.users = users if users else {}
        self.user_groups = user_groups if user_groups else {}
        self.config = config if config else {}
        self.groups = groups if groups else {}
        self.jobs = jobs if jobs else {}
        self.ai_manager = ai_manager
        self.api_key = api_key
        self.session_start_time = session_start_time
        self.session_stack = session_stack


    def _parse_command_string(self, command_string):
        """
        Parses a command string into a sequence of pipelines and segments
        using shlex for robust tokenization.
        """
        try:
            parts = shlex.split(command_string)
        except ValueError:
            return []

        if not parts:
            return []

        command_name = parts[0]
        args = []
        flags = {}

        i = 1
        while i < len(parts):
            part = parts[i]
            if part.startswith('-'):
                if i + 1 < len(parts) and not parts[i+1].startswith('-'):
                    flags[part] = parts[i+1]
                    i += 2
                else:
                    flags[part] = True
                    i += 1
            else:
                args.append(part)
                i += 1

        segment = {'command': command_name, 'args': args, 'flags': flags}
        pipeline = {'segments': [segment], 'operator': None, 'redirection': None}
        return [pipeline]

    def execute(self, command_string, stdin_data=None):
        """
        Parses and executes a full command string, including pipelines.
        """
        try:
            command_sequence = self._parse_command_string(command_string)
            if not command_sequence:
                return json.dumps({"success": True, "output": ""})

            last_result_obj = {"success": True, "output": stdin_data or ""}

            for pipeline in command_sequence:
                pipeline_input = last_result_obj.get("output", "")

                for segment in pipeline['segments']:
                    result_json = self._execute_segment(segment, pipeline_input)
                    last_result_obj = json.loads(result_json)
                    if not last_result_obj.get("success"):
                        break
                    pipeline_input = last_result_obj.get("output", "")

                if 'redirection' in pipeline and pipeline['redirection'] and last_result_obj.get("success"):
                    pass

                if 'operator' in pipeline and pipeline['operator']:
                    if pipeline['operator'] == '&&' and not last_result_obj.get("success"):
                        break
                    if pipeline['operator'] == '||' and last_result_obj.get("success"):
                        break

            return json.dumps(last_result_obj)
        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"FATAL EXECUTION ERROR: {repr(e)}\\n{tb_str}"})

    def _execute_segment(self, segment, stdin_data):
        """Executes a single command segment."""
        # This can now be a simple wrapper around the new method
        return self.run_command_by_name(
            command_name=segment['command'],
            args=segment['args'],
            flags=segment['flags'],
            user_context=self.user_context,
            stdin_data=stdin_data,
            kwargs={} # Add kwargs if the segment parsing is expanded
        )

    def run_command_by_name(self, command_name, args, flags, user_context, stdin_data, kwargs):
        """
        Directly executes a command by its name with provided arguments, bypassing string parsing.
        This is the new method that was missing.
        """
        if command_name not in self.commands:
            return json.dumps({"success": False, "error": f"{command_name}: command not found"})

        try:
            command_module = import_module(f"commands.{command_name}")
            run_func = getattr(command_module, 'run', None)
            if not run_func:
                return json.dumps({"success": False, "error": f"Command '{command_name}' is not runnable."})

            # Combine all possible arguments for the command's run function
            possible_kwargs = {
                "args": args,
                "flags": flags,
                "user_context": user_context,
                "stdin_data": stdin_data,
                "users": self.users,
                "user_groups": self.user_groups,
                "config": self.config,
                "groups": self.groups,
                "jobs": self.jobs,
                "ai_manager": self.ai_manager,
                "api_key": self.api_key,
                "session_start_time": self.session_start_time,
                "session_stack": self.session_stack,
                **kwargs # Unpack any additional kwargs, like our file data
            }

            sig = inspect.signature(run_func)
            params = sig.parameters
            has_varkw = any(p.kind == p.VAR_KEYWORD for p in params.values())

            if has_varkw:
                kwargs_for_run = possible_kwargs
            else:
                kwargs_for_run = {
                    key: value for key, value in possible_kwargs.items() if key in params
                }

            result = run_func(**kwargs_for_run)

            if isinstance(result, dict):
                if 'success' not in result:
                    result['success'] = True
                return json.dumps(result)
            else:
                return json.dumps({"success": True, "output": str(result)})

        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"Error executing '{command_name}': {repr(e)}\\n{tb_str}"})


command_executor = CommandExecutor()