# gem/core/commands/removeuser.py

from users import user_manager

def define_flags():
    """Declares the flags that the removeuser command accepts."""
    return {
        'flags': [
            {'name': 'remove-home', 'short': 'r', 'long': 'remove-home', 'takes_value': False},
            {'name': 'force', 'short': 'f', 'long': 'force', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "removeuser: only root can remove users."}

    if not args:
        return {"success": False, "error": "Usage: removeuser [-r] [-f] <username>"}

    username = args[0]
    remove_home = flags.get('remove-home', False)
    is_force = flags.get('force', False)

    if is_force:
        # If forced, directly call the deletion logic from the user_manager.
        # This is a new, direct path that doesn't involve the UI.
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
            return delete_result # Propagate the error message from the manager

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

    -r, --remove-home
          Remove the user's home directory.
    -f, --force
          Never prompt for confirmation.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the removeuser command."""
    return "Usage: removeuser [-r] [-f] <username>"