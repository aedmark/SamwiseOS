# gem/core/commands/reset.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    """
    Resets the filesystem and signals for a reboot.
    """
    try:
        fs_manager.reset()
        # After a reset, the session is invalid, so we must reboot.
        return {"effect": "reboot"}
    except Exception as e:
        return f"reset: an error occurred during filesystem reset: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    reset - reset the filesystem to its initial state

SYNOPSIS
    reset

DESCRIPTION
    The reset command completely wipes the current filesystem and restores
    it to the default, initial state. This is a destructive operation.
    The system will automatically reboot after a successful reset.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: reset"