# gem/core/commands/usermod.py

from users import user_manager
from groups import group_manager

def define_flags():
    """Declares the flags that the usermod command accepts."""
    return [
        {'name': 'append-groups', 'short': 'aG', 'takes_value': True},
        {'name': 'primary-group', 'short': 'g', 'long': 'gid', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    # Determine the current user from the session stack if available; fallback to user_context
    session_stack = kwargs.get('session_stack') if 'session_stack' in kwargs else None
    if session_stack and isinstance(session_stack, (list, tuple)) and len(session_stack) > 0:
        current_user = session_stack[-1]
    else:
        current_user = user_context.get('name')

    if current_user != 'root':
        return {"success": False, "error": "usermod: only root can modify users."}

    group_to_add = flags.get('append-groups')
    primary_group_to_set = flags.get('primary-group')

    if not args or not (group_to_add or primary_group_to_set):
        return {"success": False, "error": "Usage: usermod [-aG groupname] [-g primarygroup] <username>"}

    username = args[0]

    if not user_manager.user_exists(username):
        return {"success": False, "error": f"usermod: user '{username}' does not exist."}

    if group_to_add:
        if not group_manager.group_exists(group_to_add):
            return {"success": False, "error": f"usermod: group '{group_to_add}' does not exist."}
        if group_manager.add_user_to_group(username, group_to_add):
            return {
                "success": True,
                "output": f"Added user '{username}' to group '{group_to_add}'.",
                "effect": "sync_group_state",
                "groups": group_manager.get_all_groups()
            }
        else:
            return {"success": True, "output": f"User '{username}' is already a member of '{group_to_add}'."}

    if primary_group_to_set:
        if not group_manager.group_exists(primary_group_to_set):
            return {"success": False, "error": f"usermod: group '{primary_group_to_set}' does not exist."}

        user_manager.get_user(username)['primaryGroup'] = primary_group_to_set
        return {"success": True, "output": f"Set primary group for '{username}' to '{primary_group_to_set}'."}

    return {"success": False, "error": "usermod: no action specified."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    usermod - modify a user account

SYNOPSIS
    usermod [OPTIONS] username

DESCRIPTION
    Modifies the properties of an existing user account. This command
    requires root privileges.

OPTIONS
    -aG, --append-groups GROUP
          Add the user to the supplementary GROUP.
    -g, --gid GROUP
          Set the user's primary group.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the usermod command."""
    return "Usage: usermod [-aG group] [-g group] <username>"