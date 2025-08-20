# gem/core/commands/reboot.py

def run(args, flags, user_context, **kwargs):
    """
    Signals the front end to perform a page reload.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "reboot: command takes no arguments",
                "suggestion": "Simply run 'reboot' to restart the system."
            }
        }
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

OPTIONS
    This command takes no options.

EXAMPLES
    reboot
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: reboot"