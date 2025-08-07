# gem/core/commands/unalias.py

from session import alias_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        return "unalias: usage: unalias name [name ...]"

    error_messages = []
    for alias_name in args:
        if not alias_manager.remove_alias(alias_name):
            error_messages.append(f"unalias: no such alias: {alias_name}")

    if error_messages:
        return "\n".join(error_messages)

    return "" # Success

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    unalias - remove alias definitions

SYNOPSIS
    unalias alias_name ...

DESCRIPTION
    Removes the specified alias(es).
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: unalias <alias_name>..."