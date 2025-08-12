# gem/core/commands/explore.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Validates an optional path and returns an effect to launch the Explorer UI.
    """
    if len(args) > 1:
        return {"success": False, "error": "explore: too many arguments"}

    start_path_arg = args[0] if args else None
    resolved_path = None

    if start_path_arg:
        resolved_path = fs_manager.get_absolute_path(start_path_arg)

    return {
        "effect": "launch_app",
        "app_name": "Explorer",
        "options": {
            "startPath": resolved_path
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    explore - Opens the graphical file explorer.

SYNOPSIS
    explore [path]

DESCRIPTION
    Launches the graphical file explorer application. If an optional [path]
    is provided, the explorer will attempt to start at that location.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the explore command."""
    return "Usage: explore [path]"