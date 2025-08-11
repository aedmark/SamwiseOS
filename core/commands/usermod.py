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
    if user_context.get('name') != 'root':
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