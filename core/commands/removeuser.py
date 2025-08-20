# /core/commands/removeuser.py

from users import user_manager

def define_flags():
    return {
        'flags': [
            {'name': 'remove-home', 'short': 'r', 'long': 'remove-home', 'takes_value': False},
            {'name': 'force', 'short': 'f', 'long': 'force', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if user_context.get('name') != 'root':
        return {
            "success": False,
            "error": {
                "message": "removeuser: permission denied",
                "suggestion": "Only the 'root' user can remove other users."
            }
        }

    if not args:
        return {
            "success": False,
            "error": {
                "message": "removeuser: missing username operand",
                "suggestion": "Usage: removeuser [-r] [-f] <username>"
            }
        }

    username = args[0]
    remove_home = flags.get('remove-home', False)
    is_force = flags.get('force', False)

    if is_force:
        delete_result = user_manager.delete_user_and_data(username, remove_home)
        if delete_result.get("success"):
            return {
                "success": True,
                "output": f"User '{username}' removed.",
                "effect": "sync_user_and_group_state",
                "users": user_manager.get_all_users(),
                "groups": kwargs.get("groups")
            }
        else:
            # Propagate the already-structured error from the user_manager
            return delete_result

    # If not forced, return the confirmation effect for the UI to handle.
    return {
        "effect": "removeuser",
        "username": username,
        "remove_home": remove_home
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    removeuser - remove a user from the system

SYNOPSIS
    removeuser [-r] [-f] username

DESCRIPTION
    Removes a user account from the system. This command requires root
    privileges.

OPTIONS
    -r, --remove-home
          Remove the user's home directory.
    -f, --force
          Never prompt for confirmation, even if the user is logged in.

EXAMPLES
    sudo removeuser jerry
    sudo removeuser -r larry
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: removeuser [-r] [-f] <username>"