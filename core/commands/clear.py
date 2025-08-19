# gem/core/commands/clear.py

def run(args, flags, user_context, stdin_data=None):
    """
    Returns a special dictionary to signal a clear screen effect.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "clear: command takes no arguments",
                "suggestion": "Simply run 'clear' by itself."
            }
        }

    return {"effect": "clear_screen"}

def man(args, flags, user_context, stdin_data=None):
    """Displays the manual page for the clear command."""
    return """
NAME
    clear - clear the terminal screen

SYNOPSIS
    clear

DESCRIPTION
    The clear utility clears your screen if this is possible. It looks in
    the environment for the terminal type and then in the terminfo database
    to figure out how to clear the screen.
"""

def help(args, flags, user_context, stdin_data=None):
    """Provides help information for the clear command."""
    return "Usage: clear"