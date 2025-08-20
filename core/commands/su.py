# gem/core/commands/su.py

def run(args, flags, user_context, **kwargs):
    """
    Handles the 'su' command by returning an effect to be processed by the JS UserManager.
    """
    target_username = 'root' # Default to root if no user is specified
    password = None

    if len(args) > 2:
        return {
            "success": False,
            "error": {
                "message": "su: too many arguments",
                "suggestion": "The 'su' command takes a maximum of two arguments."
            }
        }

    if args:
        target_username = args[0]
        if len(args) > 1:
            password = args[1]

    return {
        "effect": "su",
        "username": target_username,
        "password": password
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    su - substitute user identity

SYNOPSIS
    su [username] [password]

DESCRIPTION
    The su utility allows a user to run a new shell as another user.
    If a username is not provided, it defaults to 'root'. If a password
    is not provided on the command line, the user will be prompted for one
    interactively. To return to your original session, type 'logout'.

OPTIONS
    This command takes no options.

EXAMPLES
    su
    su guest
    su root "my_secret_password"
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: su [username] [password]"