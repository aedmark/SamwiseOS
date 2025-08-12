# gem/core/commands/delay.py

import time

def run(args, flags, user_context, **kwargs):
    """
    Signals the JavaScript front end to perform a delay.
    """
    if len(args) != 1:
        return {"success": False, "error": "delay: Invalid number of arguments. Usage: delay <milliseconds>"}

    try:
        milliseconds = int(args[0])
        if milliseconds < 0:
            return {"success": False, "error": "delay: Invalid delay time. Must be a non-negative integer."}

        return {
            "effect": "delay",
            "milliseconds": milliseconds
        }

    except ValueError:
        return {"success": False, "error": f"delay: Invalid delay time '{args[0]}'. Must be an integer."}
    except Exception as e:
        return {"success": False, "error": f"delay: An unexpected error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    delay - pause script or command execution for a specified time

SYNOPSIS
    delay <milliseconds>

DESCRIPTION
    The delay command pauses execution for the specified number of
    milliseconds. It is primarily used within scripts ('run' command)
    to create timed sequences or demonstrations.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the delay command."""
    return "Usage: delay <milliseconds>"