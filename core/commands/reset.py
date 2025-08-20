# /core/commands/reset.py
from audit import audit_manager

def define_flags():
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context, **kwargs):
    """
    Signals the JavaScript front end to perform a full factory reset,
    after a confirmation prompt.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "reset: command takes no arguments",
                "suggestion": "Simply run 'reset' by itself."
            }
        }

    actor = user_context.get('name')
    audit_manager.log(actor, 'RESET_ATTEMPT', "User initiated a factory reset.", user_context)

    return {
        "effect": "confirm",
        "message": [
            "WARNING: This will perform a full factory reset.",
            "All users, files, and settings will be permanently deleted.",
            "This action cannot be undone. Are you sure you want to proceed?"
        ],
        "on_confirm": {
            "effect": "full_reset"
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    reset - reset the filesystem to its initial state

SYNOPSIS
    reset

DESCRIPTION
    The reset command completely wipes all system data from the browser,
    including the filesystem, user accounts, and all session data,
    restoring it to the default, initial state. This is a destructive
    factory reset operation and requires confirmation. This command can
    only be run by the root user.

    The system will automatically reboot after a successful reset.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo reset
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: reset"