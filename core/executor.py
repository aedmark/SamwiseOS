# core/executor.py

import shlex
import json
from importlib import import_module
from filesystem import fs_manager

class CommandExecutor:
    def __init__(self):
        self.fs_manager = fs_manager
        # The list of all migrated Python commands
        self.commands = ["date", "pwd", "echo", "ls", "whoami", "clear", "help", "man", "cat", "mkdir",
                         "touch", "rm", "mv", "grep", "sort", "wc", "uniq", "head", "tr", "base64", "cksum"]
        self.user_context = {"name": "Guest"}

    def set_context(self, user_context):
        """Sets the current user context from the JS side."""
        self.user_context = user_context if user_context else {"name": "Guest"}

    def parse_flags_and_args(self, parts):
        """A simple flag and argument parser."""
        args = []
        flags = []
        for part in parts:
            if part.startswith('-'):
                flags.append(part)
            else:
                args.append(part)
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
            result = command_module.run(args=args, flags=flags, user_context=self.user_context, stdin_data=stdin_data)

            if isinstance(result, dict):
                return json.dumps({"success": True, **result})
            else:
                return json.dumps({"success": True, "output": str(result)})

        except ImportError:
            return json.dumps({"success": False, "error": f"Error: Could not find implementation for command '{command_name}'."})
        except FileNotFoundError as e:
            return json.dumps({"success": False, "error": str(e)})
        except Exception as e:
            return json.dumps({"success": False, "error": f"Error executing '{command_name}': {repr(e)}"})

command_executor = CommandExecutor()