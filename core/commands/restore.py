# gem/core/commands/restore.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to trigger the browser's file restore workflow.
    """
    if user_context.get('name') != 'root':
        return {"success": False, "error": "restore: you must be root to run this command."}

    if args:
        return {"success": False, "error": "restore: command takes no arguments"}

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
    Restore the SamwiseOS system from a backup file (.json).
    This operation is destructive and will overwrite your entire current system.
    The command will prompt you to select a backup file and confirm before
    proceeding. This command can only be run by the root user.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the restore command."""
    return "Usage: restore"