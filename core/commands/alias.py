# gem/core/commands/alias.py

import shlex
from session import alias_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        aliases = alias_manager.get_all_aliases()
        if not aliases:
            return ""
        output = []
        for name, value in sorted(aliases.items()):
            output.append(f"alias {name}='{value}'")
        return "\n".join(output)

    arg_string = " ".join(args)
    if '=' in arg_string:
        try:
            name, value = arg_string.split('=', 1)
            # This is the new, correct logic for handling quotes
            if (value.startswith('"') and value.endswith('"')) or \
                    (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]

            alias_manager.set_alias(name, value)
            return {
                "success": True,
                "output": "",
                "effect": "sync_session_state",
                "aliases": alias_manager.get_all_aliases()
            }
        except ValueError:
            return {
                "success": False,
                "error": {
                    "message": f"alias: invalid format: {arg_string}",
                    "suggestion": "Use the format 'alias name=\"command\"'."
                }
            }
    else:
        alias_name = args[0]
        alias_value = alias_manager.get_alias(alias_name)
        if alias_value:
            return f"alias {alias_name}='{alias_value}'"
        else:
            return {
                "success": False,
                "error": {
                    "message": f"alias: {alias_name}: not found",
                    "suggestion": "To create this alias, use 'alias {alias_name}=\"your_command\"'."
                }
            }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    alias - define or display command aliases

SYNOPSIS
    alias [name[=value] ...]

DESCRIPTION
    The `alias` command allows you to create shortcuts for longer or more complex commands.
    - Running `alias` with no arguments prints the list of all current aliases.
    - With a name and value (e.g., `alias ll='ls -l'`), it creates or redefines an alias.
    - With only a name, it prints the value of that specific alias.

OPTIONS
    This command takes no options.

EXAMPLES
    alias
        Display all current aliases.
    alias ll='ls -la'
        Create a new alias named 'll'.
    alias myhome='cd /home/guest'
        Create an alias to change to a specific directory.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: alias [name='command']..."