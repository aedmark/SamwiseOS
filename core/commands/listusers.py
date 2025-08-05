# gem/core/commands/listusers.py

# This command relies on the executor to pass the user list.
# We will make the executor store this list when it's passed from JS.

def run(args, flags, user_context, stdin_data=None, users=None):
    if users is None:
        return "listusers: could not retrieve user list from the environment."

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