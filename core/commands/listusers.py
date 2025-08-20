# gem/core/commands/listusers.py

def run(args, flags, user_context, stdin_data=None, users=None):
    if args:
        return {
            "success": False,
            "error": {
                "message": "listusers: command takes no arguments",
                "suggestion": "Simply run the command by itself."
            }
        }

    if users is None:
        return {
            "success": False,
            "error": {
                "message": "listusers: could not retrieve user list from the environment.",
                "suggestion": "This may indicate a system-level issue."
            }
        }

    user_list = sorted(users.keys())

    if not user_list:
        return "No users registered."

    output = "Registered users:\n"
    output += "\n".join([f"  {user}" for user in user_list])

    return output

def man(args, flags, user_context, **kwargs):
    return """
NAME
    listusers - Lists all registered users on the system.

SYNOPSIS
    listusers

DESCRIPTION
    The listusers command displays a list of all user accounts that currently exist on the system.

OPTIONS
    This command takes no options.

EXAMPLES
    listusers
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: listusers"