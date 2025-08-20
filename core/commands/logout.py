# gem/core/commands/logout.py

def run(args, flags, user_context, **kwargs):
    if args:
        return {
            "success": False,
            "error": {
                "message": "logout: command takes no arguments",
                "suggestion": "Simply run the command by itself."
            }
        }

    return {"effect": "logout"}

def man(args, flags, user_context, **kwargs):
    """Displays the manual page for the logout command."""
    return """
NAME
    logout - terminate a login session

SYNOPSIS
    logout

DESCRIPTION
    The logout utility terminates a session. If this is the last active session for the user, they will be returned to the Guest user session.

OPTIONS
    This command takes no options.

EXAMPLES
    logout
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: logout"