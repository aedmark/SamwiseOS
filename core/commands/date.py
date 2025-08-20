# gem/core/commands/date.py

from datetime import datetime

def run(args, flags, user_context, stdin_data=None):
    """
    Returns the current date and time in a consistent format.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "date: command takes no arguments",
                "suggestion": "Simply run 'date' by itself to see the current time."
            }
        }
    # Using a format that's standard and includes timezone info
    return datetime.now().strftime('%a %b %d %H:%M:%S %Z %Y')

def man(args, flags, user_context, **kwargs):
    """
    Displays the manual page for the date command.
    """
    return """
NAME
    date - print the system date and time

SYNOPSIS
    date

DESCRIPTION
    Displays the current time and date according to the system's clock. The output format is similar to the standard Unix date command.
    (Note: Setting the date is not supported in SamwiseOS).

OPTIONS
    This command takes no options.

EXAMPLES
    date
        Displays the current date and time.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: date"