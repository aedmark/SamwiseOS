# gem/core/commands/date.py

from datetime import datetime

def run(args, flags, user_context):
    """
    Returns the current date and time.
    """
    return datetime.now().strftime('%a %b %d %H:%M:%S %Z %Y')

def man(args, flags, user_context):
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

def help(args, flags, user_context):
    """
    Provides help information for the date command.
    """
    return "Usage: date"