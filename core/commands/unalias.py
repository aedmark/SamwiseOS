# gem/core/commands/unalias.py

from session import alias_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "unalias: usage: unalias name [name ...]",
                "suggestion": "Provide the name of the alias you wish to remove."
            }
        }

    error_messages = []
    changed = False
    for alias_name in args:
        if alias_manager.remove_alias(alias_name):
            changed = True
        else:
            error_messages.append(f"unalias: no such alias: {alias_name}")

    if error_messages:
        # Even on failure, we sync state in case some aliases were removed successfully
        effect = {
            "effect": "sync_session_state",
            "aliases": alias_manager.get_all_aliases()
        } if changed else None

        final_error = {
            "success": False,
            "error": {
                "message": "\n".join(error_messages),
                "suggestion": "You can list all current aliases by running 'alias'."
            }
        }
        if effect:
            final_error["effects"] = [effect] # Embed effect within the error response
        return final_error

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