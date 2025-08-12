# gem/core/commands/groupadd.py

from groups import group_manager

def run(args, flags, user_context, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "groupadd: only root can add groups."}

    if not args:
        return {"success": False, "error": "groupadd: missing group name"}

    group_name = args[0]

    if ' ' in group_name:
        return {"success": False, "error": "groupadd: group names cannot contain spaces."}

    if group_manager.group_exists(group_name):
        return {"success": False, "error": f"groupadd: group '{group_name}' already exists."}

    if group_manager.create_group(group_name):
        return {
            "success": True,
            "output": "",
            "effect": "sync_group_state",
            "groups": group_manager.get_all_groups()
        }
    else:
        # This case should be rare, but we'll handle it.
        return {"success": False, "error": f"groupadd: failed to create group '{group_name}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    groupadd - create a new group

SYNOPSIS
    groupadd group_name

DESCRIPTION
    Creates a new group with the specified name. This command can only
    be run by the root user. Group names cannot contain spaces.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the groupadd command."""
    return "Usage: groupadd <group_name>"