# gem/core/commands/groupdel.py

from groups import group_manager

def run(args, flags, user_context, users=None, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "groupdel: only root can delete groups."}

    if not args:
        return {"success": False, "error": "groupdel: missing group name"}

    group_name = args[0]

    if not group_manager.group_exists(group_name):
        return {"success": False, "error": f"groupdel: group '{group_name}' does not exist."}

    # Check if it's a primary group for any user
    if users:
        for user, details in users.items():
            if details.get('primaryGroup') == group_name:
                return {"success": False, "error": f"groupdel: cannot remove group '{group_name}': it is the primary group of user '{user}'"}

    if group_manager.delete_group(group_name):
        return {
            "success": True,
            "output": "",
            "effect": "sync_group_state",
            "groups": group_manager.get_all_groups()
        }
    else:
        # This case is unlikely if the existence check passed, but we handle it.
        return {"success": False, "error": f"groupdel: failed to delete group '{group_name}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    groupdel - delete a group

SYNOPSIS
    groupdel group_name

DESCRIPTION
    Deletes an existing group. You cannot delete the primary group of an
    existing user. This command can only be run by the root user.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the groupdel command."""
    return "Usage: groupdel <group_name>"