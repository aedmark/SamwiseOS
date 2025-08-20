# gem/core/commands/whoami.py

def run(args, flags, user_context, stdin_data=None):
    """
    Returns the current user's name.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "whoami: command takes no arguments",
                "suggestion": "Simply run 'whoami' by itself."
            }
        }
    return user_context.get('name', 'guest')

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the whoami command.
    """
    return """
NAME
    whoami - print effective user ID

SYNOPSIS
    whoami

DESCRIPTION
    Prints the user name associated with the current effective user ID.

OPTIONS
    This command takes no options.

EXAMPLES
    whoami
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: whoami"