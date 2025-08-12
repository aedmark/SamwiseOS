# gem/core/commands/reboot.py

def run(args, flags, user_context, **kwargs):
    """
    Signals the front end to perform a page reload.
    """
    if args:
        return {"success": False, "error": "reboot: command takes no arguments"}
    return {"effect": "reboot"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    reboot - reboot the system

SYNOPSIS
    reboot

DESCRIPTION
    Stops all running processes and restarts the SamwiseOS session by
    reloading the page.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the reboot command."""
    return "Usage: reboot"