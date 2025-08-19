# gem/core/commands/useradd.py

from users import user_manager
from filesystem import fs_manager
from groups import group_manager
from audit import audit_manager

def define_flags():
    """Declares the flags that the useradd command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }


def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {"success": False, "error": "Usage: useradd <username>"}

    username = args[0]
    actor = user_context.get('name')

    audit_manager.log(actor, 'USERADD_ATTEMPT', f"Attempting to add user '{username}'", user_context)

    if user_manager.user_exists(username):
        error_msg = f"useradd: user '{username}' already exists"
        audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg}", user_context)
        return {"success": False, "error": error_msg}

    if stdin_data:
        try:
            lines = stdin_data.strip().split('\n')
            if len(lines) < 2:
                error_msg = "useradd: insufficient password lines from stdin"
                audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
                return {"success": False, "error": error_msg}

            password, confirm_password = lines[0], lines[1]

            if password != confirm_password:
                error_msg = "passwd: passwords do not match."
                audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
                return {"success": False, "error": error_msg}

            if not group_manager.group_exists(username):
                if not group_manager.create_group(username):
                    error_msg = f"useradd: failed to create group '{username}'"
                    audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg}", user_context)
                    return {"success": False, "error": error_msg}

            group_manager.add_user_to_group(username, username)
            registration_result = user_manager.register_user(username, password, username)

            if registration_result["success"]:
                home_path = f"/home/{username}"
                fs_manager.create_directory(home_path, {"name": "root", "group": "root"})
                fs_manager.chown(home_path, username)
                fs_manager.chgrp(home_path, username)
                audit_manager.log(actor, 'USERADD_SUCCESS', f"Successfully added user '{username}'", user_context)
                return {
                    "success": True,
                    "output": f"User '{username}' registered. Home directory created at /home/{username}.",
                    "effect": "sync_user_and_group_state",
                    "users": user_manager.get_all_users(),
                    "groups": group_manager.get_all_groups()
                }
            else:
                audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {registration_result.get('error')}", user_context)
                return registration_result
        except IndexError:
            error_msg = "useradd: malformed password lines from stdin"
            audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
            return {"success": False, "error": error_msg}
    else:
        return {"effect": "useradd", "username": username}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    useradd - create a new user or update default new user information

SYNOPSIS
    useradd [username]

DESCRIPTION
    Creates a new user account with the specified username. If run
    interactively, it will now reliably prompt for a new password. When used within a
    script via the 'run' command, the password and confirmation can be
    supplied on the next two lines. This command requires root privileges.
"""


def help(args, flags, user_context, **kwargs):
    """Provides help information for the useradd command."""
    return "Usage: useradd <username>"