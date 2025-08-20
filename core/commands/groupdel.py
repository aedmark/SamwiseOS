# gem/core/commands/groupdel.py

from groups import group_manager

def define_flags():
    """Declares the flags that this command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context, users=None, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "groupdel: missing group name",
                "suggestion": "Try 'groupdel <group_to_delete>'."
            }
        }

    group_name = args[0]

    if not group_manager.group_exists(group_name):
        return {
            "success": False,
            "error": {
                "message": f"groupdel: group '{group_name}' does not exist.",
                "suggestion": "You can list all available groups with the 'groups' command."
            }
        }

    # Check if it's a primary group for any user
    if users:
        for user, details in users.items():
            if details.get('primaryGroup') == group_name:
                return {
                    "success": False,
                    "error": {
                        "message": f"groupdel: cannot remove group '{group_name}': it is the primary group of user '{user}'",
                        "suggestion": f"Change the primary group for user '{user}' before deleting this group."
                    }
                }

    if group_manager.delete_group(group_name):
        return {
            "success": True,
            "output": "",
            "effect": "sync_group_state",
            "groups": group_manager.get_all_groups()
        }
    else:
        # This case is unlikely if the existence check passed, but we handle it.
        return {
            "success": False,
            "error": {
                "message": f"groupdel: failed to delete group '{group_name}'.",
                "suggestion": "This may be an internal system error. Please try again."
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    groupdel - delete a group

SYNOPSIS
    groupdel group_name

DESCRIPTION
    Deletes an existing group. You cannot delete the primary group of an
    existing user. This command can only be run by the root user.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo groupdel old_project
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: groupdel <group_name>"