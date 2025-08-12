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
            value_parts = shlex.split(value)
            value = value_parts[0] if value_parts else ""

            alias_manager.set_alias(name, value)
            return {
                "success": True,
                "output": "",
                "effect": "sync_session_state",
                "aliases": alias_manager.get_all_aliases()
            }
        except ValueError:
            return {"success": False, "error": f"alias: invalid format: {arg_string}"}
    else:
        alias_name = args[0]
        alias_value = alias_manager.get_alias(alias_name)
        if alias_value:
            return f"alias {alias_name}='{alias_value}'"
        else:
            # Standardizing this to be a failure case for scripting
            return {"success": False, "error": f"alias: {alias_name}: not found"}

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    alias - define or display aliases

SYNOPSIS
    alias [name[=value] ...]

DESCRIPTION
    Alias allows you to create shortcuts for commands. Without arguments,
    `alias` prints the list of all aliases. With a name and value, it
    creates or redefines an alias. With only a name, it prints that alias.
"""

def help(args, flags, user_context, stdin_data=None):
    """Provides help information for the alias command."""
    return "Usage: alias [name='command']..."