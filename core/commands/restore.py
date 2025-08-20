# /core/commands/restore.py

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
    Returns an effect to trigger the browser's file restore workflow.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "restore: command takes no arguments",
                "suggestion": "Simply run 'restore' by itself."
            }
        }

    actor = user_context.get('name')
    audit_manager.log(actor, 'RESTORE_ATTEMPT', "User initiated a system restore.", user_context)
    return {
        "effect": "trigger_restore_flow"
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    restore - Restores the SamwiseOS system state from a backup file.

SYNOPSIS
    restore

DESCRIPTION
    Restores the SamwiseOS system from a backup file (.json).
    This operation is destructive and will overwrite your entire current system.
    The command will prompt you to select a backup file and confirm before
    proceeding. This command can only be run by the root user.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo restore
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: restore"