# gem/core/commands/unset.py

from session import env_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "unset: not enough arguments",
                "suggestion": "Try 'unset <variable_name>'."
            }
        }

    for var_name in args:
        env_manager.unset(var_name)

    return {
        "success": True,
        "output": "",
        "effect": "sync_session_state",
        "env": env_manager.get_all()
    }

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    unset - unset shell variables

SYNOPSIS
    unset [variable_name]...

DESCRIPTION
    The unset command removes the specified environment variable(s).
    Once unset, a variable will no longer be available to commands
    or for expansion.

OPTIONS
    This command takes no options.

EXAMPLES
    unset MY_VAR
    unset TEMP_DIR OLD_PROMPT
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: unset <variable_name>..."