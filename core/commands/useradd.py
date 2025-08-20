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
        return {
            "success": False,
            "error": {
                "message": "useradd: missing username operand",
                "suggestion": "Try 'useradd <new_username>'."
            }
        }

    username = args[0]
    actor = user_context.get('name')

    audit_manager.log(actor, 'USERADD_ATTEMPT', f"Attempting to add user '{username}'", user_context)

    validation_result = user_manager.validate_username_format(username)
    if not validation_result["success"]:
        return {"success": False, "error": {"message": f"useradd: {validation_result['error']}", "suggestion": "Please choose a different username."}}


    if user_manager.user_exists(username):
        error_msg = f"useradd: user '{username}' already exists"
        audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg}", user_context)
        return {
            "success": False,
            "error": {
                "message": error_msg,
                "suggestion": "Please choose a different username."
            }
        }

    if stdin_data:
        try:
            lines = stdin_data.strip().split('\n')
            if len(lines) < 2:
                error_msg = "useradd: insufficient password lines from stdin"
                audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
                return {
                    "success": False,
                    "error": {
                        "message": error_msg,
                        "suggestion": "When scripting, provide the password and confirmation on two separate lines after the useradd command."
                    }
                }

            password, confirm_password = lines[0], lines[1]

            if password != confirm_password:
                error_msg = "passwd: passwords do not match."
                audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
                return {
                    "success": False,
                    "error": {
                        "message": error_msg,
                        "suggestion": "Ensure the password and confirmation password match exactly."
                    }
                }

            if not group_manager.group_exists(username):
                if not group_manager.create_group(username):
                    error_msg = f"useradd: failed to create group '{username}'"
                    audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg}", user_context)
                    return {"success": False, "error": {"message": error_msg, "suggestion": "An internal error occurred."}}

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
                return {"success": False, "error": {"message": registration_result.get('error'), "suggestion": "An internal error occurred during user registration."}}
        except IndexError:
            error_msg = "useradd: malformed password lines from stdin"
            audit_manager.log(actor, 'USERADD_FAILURE', f"Reason: {error_msg} for user '{username}'", user_context)
            return {
                "success": False,
                "error": {
                    "message": error_msg,
                    "suggestion": "Check the script for empty lines after the command."
                }
            }
    else:
        return {"effect": "useradd", "username": username}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    useradd - create a new user account

SYNOPSIS
    useradd [username]

DESCRIPTION
    Creates a new user account with the specified username. This command
    also creates a primary group with the same name and a home directory
    at /home/<username>. If run interactively, it will prompt for a new
    password. This command requires root privileges.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo useradd jerry
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: useradd <username>"