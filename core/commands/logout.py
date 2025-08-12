# gem/core/commands/logout.py

def run(args, flags, user_context, **kwargs):
    if args:
        return {"success": False, "error": "logout: command takes no arguments"}

    return {"effect": "logout"}

def man(args, flags, user_context, **kwargs):
    """Displays the manual page for the logout command."""
    return """
NAME
    logout - terminate a login session

SYNOPSIS
    logout

DESCRIPTION
    The logout utility terminates a session. If this is the last active
    session for the user, they will be returned to the Guest user session.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the logout command."""
    return "Usage: logout"