# gem/core/commands/reset.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    """
    Signals the JavaScript front end to perform a full factory reset.
    """
    if user_context.get('name') != 'root':
        return {"success": False, "error": "reset: you must be root to run this command."}

    # This effect will be caught by the JavaScript command executor.
    return {"effect": "full_reset"}

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    reset - reset the filesystem to its initial state

SYNOPSIS
    reset

DESCRIPTION
    The reset command completely wipes all system data from the browser,
    including the filesystem, user accounts, and all session data,
    restoring it to the default, initial state. This is a destructive
    factory reset operation. This command can only be run by the root user.

    The system will automatically reboot after a successful reset.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: reset"