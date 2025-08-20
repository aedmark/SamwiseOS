# gem/core/commands/top.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to launch the Top UI (process viewer).
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "top: command takes no arguments",
                "suggestion": "Simply run 'top' by itself."
            }
        }

    return {
        "effect": "launch_app",
        "app_name": "Top",
        "options": {}
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    top - display a real-time view of running processes

SYNOPSIS
    top

DESCRIPTION
    Provides a dynamic, real-time view of the processes running in SamwiseOS.
    The top command opens a full-screen application that lists all active
    background jobs and system processes. The list is updated automatically.
    Press 'q' or 'Escape' to quit.

OPTIONS
    This command takes no options.

EXAMPLES
    top
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: top"