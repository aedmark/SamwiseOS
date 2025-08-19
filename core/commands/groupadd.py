# gem/core/commands/groupadd.py

from groups import group_manager
from audit import audit_manager

def run(args, flags, user_context, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "groupadd: missing group name",
                "suggestion": "Try 'groupadd <new_group_name>'."
            }
        }

    group_name = " ".join(args)
    actor = user_context.get('name')
    audit_manager.log(actor, 'GROUPADD_ATTEMPT', f"Attempting to add group '{group_name}'", user_context)

    if ' ' in group_name:
        error_msg = "groupadd: group names cannot contain spaces."
        audit_manager.log(actor, 'GROUPADD_FAILURE', f"Reason: {error_msg}", user_context)
        return {
            "success": False,
            "error": {
                "message": error_msg,
                "suggestion": "Group names should be a single word, like 'developers' or 'testers'."
            }
        }

    if group_manager.group_exists(group_name):
        error_msg = f"groupadd: group '{group_name}' already exists."
        audit_manager.log(actor, 'GROUPADD_FAILURE', f"Reason: {error_msg}", user_context)
        return {
            "success": False,
            "error": {
                "message": error_msg,
                "suggestion": "Choose a different name for your new group."
            }
        }

    if group_manager.create_group(group_name):
        audit_manager.log(actor, 'GROUPADD_SUCCESS', f"Successfully added group '{group_name}'", user_context)
        return {
            "success": True,
            "output": "",
            "effect": "sync_group_state",
            "groups": group_manager.get_all_groups()
        }
    else:
        error_msg = f"groupadd: failed to create group '{group_name}'."
        audit_manager.log(actor, 'GROUPADD_FAILURE', f"Reason: {error_msg}", user_context)
        return {
            "success": False,
            "error": {
                "message": error_msg,
                "suggestion": "This might be an internal error. Please try again."
            }
        }

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