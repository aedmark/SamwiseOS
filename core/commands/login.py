# gem/core/commands/login.py

def run(args, flags, user_context, stdin_data=None):
    if not 1 <= len(args) <= 2:
        return {"success": False, "error": "Usage: login <username> [password]"}

    # This logic is adapted from su.py for clarity and robustness.
    username = None
    password = None

    if args:
        username = args[0]
        if len(args) > 1:
            password = args[1]

    # This should never happen due to the guard clause, but it's safe.
    if not username:
        return {"success": False, "error": "Usage: login <username> [password]"}

    return {
        "effect": "login",
        "username": username,
        "password": password
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    login - begin a session on the system

SYNOPSIS
    login <username> [password]

DESCRIPTION
    The login utility logs a new user into the system. If a password
    is not provided on the command line, the user will be prompted for one.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the login command."""
    return "Usage: login <username> [password]"