# gem/core/commands/listusers.py

def run(args, flags, user_context, stdin_data=None, users=None):
    if args:
        return {"success": False, "error": "listusers: command takes no arguments"}

    if users is None:
        return {"success": False, "error": "listusers: could not retrieve user list from the environment."}

    user_list = sorted(users.keys())

    if not user_list:
        return "No users registered."

    output = "Registered users:\n"
    output += "\n".join([f"  {user}" for user in user_list])

    return output

def man(args, flags, user_context, stdin_data=None, users=None):
    return """
NAME
    listusers - Lists all registered users on the system.

SYNOPSIS
    listusers

DESCRIPTION
    The listusers command displays a list of all user accounts that
    currently exist on the system.
"""

def help(args, flags, user_context, stdin_data=None, users=None):
    return "Usage: listusers"