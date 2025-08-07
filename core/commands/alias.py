# gem/core/commands/alias.py

import shlex
from session import alias_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        aliases = alias_manager.get_all_aliases()
        if not aliases:
            return ""
        output = []
        # The .items() method on PyProxy is not standard, convert to dict first
        alias_dict = dict(aliases.toJs())
        for name, value in sorted(alias_dict.items()):
            output.append(f"alias {name}='{value}'")
        return "\n".join(output)

    arg_string = " ".join(args)
    if '=' in arg_string:
        # Set an alias
        try:
            name, value = arg_string.split('=', 1)
            # shlex.split can handle quotes around the value
            value_parts = shlex.split(value)
            if len(value_parts) == 1:
                value = value_parts[0]
            else: # If shlex finds no quotes, it might split. Rejoin.
                value = " ".join(value_parts)

            alias_manager.set_alias(name, value)
            return "" # Success
        except ValueError:
            return f"alias: invalid format: {arg_string}"
    else:
        # Get a specific alias
        alias_name = args[0]
        alias_value = alias_manager.get_alias(alias_name)
        if alias_value:
            return f"alias {alias_name}='{alias_value}'"
        else:
            return f"alias: {alias_name}: not found"

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    alias - define or display aliases

SYNOPSIS
    alias [name[=value] ...]

DESCRIPTION
    Alias allows you to create shortcuts for commands.
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: alias [name='command']..."