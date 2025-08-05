# gem/core/commands/whoami.py

def run(args, flags, user_context):
    """
    Returns the current user's name.
    """
    return user_context.get('name', 'guest')

def man(args, flags, user_context):
    """
    Displays the manual page for the whoami command.
    """
    return """
NAME
    whoami - print effective user ID

SYNOPSIS
    whoami

DESCRIPTION
    Print the user name associated with the current effective user ID.
"""

def help(args, flags, user_context):
    """
    Provides help information for the whoami command.
    """
    return "Usage: whoami"