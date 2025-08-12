# gem/core/commands/unalias.py

from session import alias_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        return {"success": False, "error": "unalias: usage: unalias name [name ...]"}

    error_messages = []
    changed = False
    for alias_name in args:
        if alias_manager.remove_alias(alias_name):
            changed = True
        else:
            error_messages.append(f"unalias: no such alias: {alias_name}")

    if error_messages:
        return {
            "success": False,
            "error": "\\n".join(error_messages),
            "effect": "sync_session_state",
            "aliases": alias_manager.get_all_aliases()
        }

    if changed:
        return {
            "success": True,
            "output": "",
            "effect": "sync_session_state",
            "aliases": alias_manager.get_all_aliases()
        }
    return ""

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
    """Provides help information for the unalias command."""
    return "Usage: unalias <alias_name>..."