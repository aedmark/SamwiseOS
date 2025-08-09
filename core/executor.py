# gem/core/executor.py

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

    def set_context(self, user_context, users, user_groups, config, groups, jobs, ai_manager, api_key):
        """Sets the current user and system context from the JS side."""
        self.user_context = user_context if user_context else {"name": "Guest"}
        self.users = users if users else {}
        self.user_groups = user_groups if user_groups else {}
        self.config = config if config else {}
        self.groups = groups if groups else {}
        self.jobs = jobs if jobs else {}
        self.ai_manager = ai_manager
        self.api_key = api_key

    def _parse_command_string(self, command_string):
        """
        Parses a command string into a sequence of pipelines and segments
        using shlex for robust tokenization.
        """
        try:
            parts = shlex.split(command_string)
        except ValueError:
            return [] # Handles errors like unmatched quotes

        if not parts:
            return []

        command_name = parts[0]
        args = []
        flags = {}

        i = 1
        while i < len(parts):
            part = parts[i]
            if part.startswith('-'):
                # This handles flags like '-l' and value-taking flags like '-n 5'
                if i + 1 < len(parts) and not parts[i+1].startswith('-'):
                    flags[part] = parts[i+1]
                    i += 1
                else:
                    flags[part] = True
            else:
                args.append(part)
            i += 1

        segment = {'command': command_name, 'args': args, 'flags': flags}
        # For now, we assume a single command per line.
        pipeline = {'segments': [segment], 'operator': None}
        return [pipeline]


    def execute(self, command_string, stdin_data=None):
        """
        Parses and executes a full command string, including pipelines.
        """
        command_sequence = self._parse_command_string(command_string)

        last_result_obj = {"success": True, "output": stdin_data or ""}

        for pipeline in command_sequence:
            pipeline_input = last_result_obj.get("output", "")

            # Execute segments within the pipeline
            for i, segment in enumerate(pipeline['segments']):
                # This is a significant simplification. A real implementation would handle
                # subprocesses and stream stdin/stdout. For now, we pass output as a string.
                is_last_segment = (i == len(pipeline['segments']) - 1)

                result_json = self._execute_segment(segment, pipeline_input)
                last_result_obj = json.loads(result_json)

                # If a command in the pipe fails, the whole pipe fails.
                if not last_result_obj.get("success"):
                    break

                pipeline_input = last_result_obj.get("output", "")

            # Handle redirection
            if 'redirection' in pipeline and last_result_obj.get("success"):
                redir = pipeline['redirection']
                file_to_write = redir['file']
                content_to_write = last_result_obj.get("output", "")

                # Append mode
                if redir['type'] == '>>':
                    existing_node = self.fs_manager.get_node(file_to_write)
                    if existing_node and 'content' in existing_node:
                        content_to_write = existing_node['content'] + "\\n" + content_to_write

                try:
                    self.fs_manager.write_file(file_to_write, content_to_write, self.user_context)
                    last_result_obj['output'] = "" # Output was redirected
                except Exception as e:
                    return json.dumps({"success": False, "error": f"Redirection error: {repr(e)}"})

            # Handle logical operators (&& and ||)
            if pipeline['operator'] == '&&' and not last_result_obj.get("success"):
                break
            if pipeline['operator'] == '||' and last_result_obj.get("success"):
                break

        return json.dumps(last_result_obj)


    def _execute_segment(self, segment, stdin_data):
        """Executes a single command segment."""
        command_name = segment['command']

        if command_name not in self.commands:
            return json.dumps({"success": False, "error": f"{command_name}: command not found"})

        try:
            command_module = import_module(f"commands.{command_name}")
            run_func = getattr(command_module, 'run', None)
            if not run_func:
                return json.dumps({"success": False, "error": f"Command '{command_name}' is not runnable."})

            possible_kwargs = {
                "args": segment['args'],
                "flags": segment['flags'],
                "user_context": self.user_context,
                "stdin_data": stdin_data,
                "users": self.users,
                "user_groups": self.user_groups,
                "config": self.config,
                "groups": self.groups,
                "jobs": self.jobs,
                "ai_manager": self.ai_manager,
                "api_key": self.api_key
            }

            sig = inspect.signature(run_func)
            filtered_kwargs = {k: v for k, v in possible_kwargs.items() if k in sig.parameters}

            result = run_func(**filtered_kwargs)

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