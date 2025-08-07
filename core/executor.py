# core/executor.py

import shlex
import json
from importlib import import_module
from filesystem import fs_manager
import inspect
import os

class CommandExecutor:
    def __init__(self):
        self.fs_manager = fs_manager
        # [MODIFIED] Commands are now discovered dynamically
        self.commands = self._discover_commands()
        self.user_context = {"name": "Guest"}
        self.users = {}
        self.user_groups = {}
        self.config = {}
        self.groups = {}
        self.jobs = {}

    def _discover_commands(self):
        """Dynamically finds all available command modules."""
        command_dir = os.path.join(os.path.dirname(__file__), 'commands')
        py_files = [f for f in os.listdir(command_dir) if f.endswith('.py') and not f.startswith('__')]
        return [os.path.splitext(f)[0] for f in py_files]

    def set_context(self, user_context, users, user_groups, config, groups, jobs):
        self.users = users if users else {}
        self.user_groups = user_groups if user_groups else {}
        self.config = config if config else {}
        self.groups = groups if groups else {}
        self.jobs = jobs if jobs else {}
        """Sets the current user context from the JS side."""
        self.user_context = user_context if user_context else {"name": "Guest"}

    def parse_flags_and_args(self, parts):
        """A simple flag and argument parser."""
        args = []
        flags = {} # Changed to a dictionary for key-value pairs
        i = 0
        while i < len(parts):
            part = parts[i]
            if part.startswith('-'):
                flag = part
                # Check if the next part is a value for this flag
                if i + 1 < len(parts) and not parts[i+1].startswith('-'):
                    flags[flag] = parts[i+1]
                    i += 1 # Skip the next part since it's a value
                else:
                    flags[flag] = True # Flag without a value
            else:
                args.append(part)
            i += 1
        return args, flags


    def execute(self, command_string, stdin_data=None):
        """
        Parses and executes a given command string.
        """
        try:
            parts = shlex.split(command_string)
        except ValueError as e:
            return json.dumps({"success": False, "error": f"Parse error: {e}"})

        if not parts:
            return json.dumps({"success": True, "output": ""})

        command_name = parts[0]

        if command_name not in self.commands:
            return json.dumps({"success": False, "error": f"{command_name}: command not found"})

        args, flags = self.parse_flags_and_args(parts[1:])

        try:
            command_module = import_module(f"commands.{command_name}")
            run_func = getattr(command_module, 'run', None)
            if not run_func:
                return json.dumps({"success": False, "error": f"Command '{command_name}' is not runnable."})


            # Build the argument list and send only what the command expects
            possible_kwargs = {
                "args": args,
                "flags": flags,
                "user_context": self.user_context,
                "stdin_data": stdin_data,
                "users": self.users,
                "user_groups": self.user_groups,
                "config": self.config,
                "groups": self.groups,
                "jobs": self.jobs,
            }

            sig = inspect.signature(run_func)
            filtered_kwargs = {
                k: v for k, v in possible_kwargs.items() if k in sig.parameters
            }

            result = run_func(**filtered_kwargs)

            if isinstance(result, dict):
                # Ensure success is explicitly part of the dictionary for consistency
                if 'success' not in result:
                    result['success'] = True
                return json.dumps(result)
            else:
                return json.dumps({"success": True, "output": str(result)})

        except ImportError:
            return json.dumps({"success": False, "error": f"Error: Could not find implementation for command '{command_name}'."})
        except FileNotFoundError as e:
            return json.dumps({"success": False, "error": str(e)})
        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            return json.dumps({"success": False, "error": f"Error executing '{command_name}': {repr(e)}\n{tb_str}"})

command_executor = CommandExecutor()