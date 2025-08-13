# gem/core/commands/su.py

def run(args, flags, user_context, stdin_data=None):
    """
    Handles the 'su' command by creating an effect for the JavaScript
    layer to process, now including an optional password.
    """
    if len(args) > 2:
        return {"success": False, "error": "su: too many arguments. Usage: su [username] [password]"}

    # Handle the different valid argument counts
    if len(args) == 0:
        # `su` with no arguments defaults to switching to root
        username = "root"
        password = None
    elif len(args) == 1:
        # `su <username>`
        username = args[0]
        password = None
    else: # len(args) == 2
        # `su <username> <password>`
        username = args[0]
        password = args[1]

    # Override password if provided via stdin (for scripting)
    if stdin_data:
        password = stdin_data.strip().split('\\n')[0]

    return {
        "effect": "su",
        "username": username,
        "password": password
    }

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the su command.
    """
    return """
NAME
su - substitute user identity

SYNOPSIS
su [username] [password]

DESCRIPTION
The su utility requests appropriate credentials via password and switches
to that user and that user's environment. If no username is specified,
it defaults to switching to the superuser, root.

Providing a password as a second argument or via standard input is
supported for scripting but is not recommended for interactive use.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the su command.
    """
    return "Usage: su [username] [password]"