# gem/core/commands/delay.py

import time

def run(args, flags, user_context, **kwargs):
    """
    Signals the JavaScript front end to perform a delay.
    """
    if len(args) != 1:
        return {
            "success": False,
            "error": {
                "message": "delay: invalid number of arguments",
                "suggestion": "Try 'delay <milliseconds>'."
            }
        }
    try:
        milliseconds = int(args[0])
        if milliseconds < 0:
            return {
                "success": False,
                "error": {
                    "message": "delay: invalid delay time",
                    "suggestion": "The delay must be a non-negative integer."
                }
            }
        return {
            "effect": "delay",
            "milliseconds": milliseconds
        }
    except ValueError:
        return {
            "success": False,
            "error": {
                "message": f"delay: invalid delay time '{args[0]}'",
                "suggestion": "The delay must be an integer representing milliseconds."
            }
        }
    except Exception as e:
        return {"success": False, "error": {"message": f"delay: an unexpected error occurred: {repr(e)}", "suggestion": "Please check your input and try again."}}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    delay - pause script or command execution for a specified time

SYNOPSIS
    delay <milliseconds>

DESCRIPTION
    The delay command pauses execution for the specified number of milliseconds. It is primarily used within scripts (executed via the 'run' command) to create timed sequences, demonstrations, or to wait for a background process.

OPTIONS
    This command takes no options.

EXAMPLES
    delay 1000
        Pauses execution for 1 second (1000 milliseconds).
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: delay <milliseconds>"