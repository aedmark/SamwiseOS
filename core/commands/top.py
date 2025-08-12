# gem/core/commands/top.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to launch the Top UI (process viewer).
    """
    if args:
        return {"success": False, "error": "top: command takes no arguments"}

    return {
        "effect": "launch_app",
        "app_name": "Top",
        "options": {}
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    top - Displays a real-time view of running processes.

SYNOPSIS
    top

DESCRIPTION
    Provides a dynamic, real-time view of the processes running in OopisOS.
    The top command opens a full-screen application that lists all active
    background jobs and system processes. The list is updated in real-time.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the top command."""
    return "Usage: top"