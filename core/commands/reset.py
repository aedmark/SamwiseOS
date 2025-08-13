# gem/core/commands/reset.py

def run(args, flags, user_context, **kwargs):
    """
    Signals the JavaScript front end to perform a full factory reset,
    after a confirmation prompt.
    """
    if user_context.get('name') != 'root':
        return {"success": False, "error": "reset: you must be root to run this command."}

    if args:
        return {"success": False, "error": "reset: command takes no arguments"}

    # Instead of a direct effect, we now return a 'confirm' effect.
    # If the user confirms in the UI, the 'on_confirm' effect will be executed.
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
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the reset command."""
    return "Usage: reset"