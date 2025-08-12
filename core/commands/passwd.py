# gem/core/commands/passwd.py

def run(args, flags, user_context, **kwargs):
    if len(args) > 1:
        return {"success": False, "error": "Usage: passwd [username]"}

    target_username = args[0] if args else user_context.get('name')

    if user_context.get('name') != 'root' and target_username != user_context.get('name'):
        return {"success": False, "error": "passwd: you may only change your own password."}

    return {
        "effect": "passwd",
        "username": target_username
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    passwd - change user password

SYNOPSIS
    passwd [username]

DESCRIPTION
    The passwd utility changes the password for the specified user account.
    If no username is provided, it changes the password for the current user.
    Running this command will begin an interactive prompt to enter the new password.
    A regular user may only change their own password. The super-user (root)
    may change the password for any account.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the passwd command."""
    return "Usage: passwd [username]"