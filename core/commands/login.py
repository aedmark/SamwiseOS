# gem/core/commands/login.py

def run(args, flags, user_context, stdin_data=None):
    if not 1 <= len(args) <= 2:
        return {
            "success": False,
            "error": {
                "message": "login: incorrect number of arguments",
                "suggestion": "Try 'login <username> [password]'."
            }
        }

    username = args[0]
    password = args[1] if len(args) > 1 else (stdin_data.strip().split('\\n')[0] if stdin_data else None)

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