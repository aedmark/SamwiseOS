# gem/core/commands/delay.py

import time

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if len(args) != 1:
        return "delay: Invalid number of arguments. Usage: delay <milliseconds>"

    try:
        milliseconds = int(args[0])
        if milliseconds < 0:
            return "delay: Invalid delay time. Must be a non-negative integer."

        # Return an effect to be handled by the JS CommandExecutor
        return {
            "effect": "delay",
            "milliseconds": milliseconds
        }

    except ValueError:
        return f"delay: Invalid delay time '{args[0]}'. Must be an integer."
    except Exception as e:
        return f"delay: An unexpected error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
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

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: delay <milliseconds>"