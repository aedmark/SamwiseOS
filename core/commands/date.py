# gem/core/commands/date.py

from datetime import datetime

def run(args, flags, user_context, stdin_data=None):
    """
    Returns the current date and time in a consistent format.
    """
    if args:
        return {"success": False, "error": "date: command takes no arguments"}
    # We are changing the format string to place the Year (%Y) before the
    # timezone offset (%z). This makes the output predictable for scripts!
    return datetime.now().strftime('%a %b %d %H:%M:%S %Y %z')

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the date command.
    """
    return """
NAME
    date - print or set the system date and time

SYNOPSIS
    date

DESCRIPTION
    Displays the current time and date.
    (Note: Setting the date is not supported in SamwiseOS).
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the date command.
    """
    return "Usage: date"