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

def man(args, flags, user_context, **kwargs):
    """Displays the manual page for the clear command."""
    return """
NAME
    clear - clear the terminal screen

SYNOPSIS
    clear

DESCRIPTION
    The clear utility clears the terminal screen of all previous output, moving the prompt to the top of the window.

OPTIONS
    This command takes no options.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: clear"