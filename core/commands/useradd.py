# gem/core/commands/useradd.py

from users import user_manager
from filesystem import fs_manager
from groups import group_manager


def run(args, flags, user_context, stdin_data=None, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "useradd: only root can add users."}

    if not args:
        return {"success": False, "error": "Usage: useradd <username>"}

    username = args[0]

    if user_manager.user_exists(username):
        return {"success": False, "error": f"useradd: user '{username}' already exists"}

    if stdin_data:
        try:
            # The rest of the logic can now proceed with confidence!
            lines = stdin_data.strip().split('\n')
            if len(lines) < 2:
                return {"success": False, "error": "useradd: insufficient password lines from stdin"}

            password = lines[0]
            confirm_password = lines[1]

            if password != confirm_password:
                return {"success": False, "error": "passwd: passwords do not match."}

            # Create the primary group for the user
            if not group_manager.group_exists(username):
                if not group_manager.create_group(username):
                    return {"success": False, "error": f"useradd: failed to create group '{username}'"}
                group_manager.add_user_to_group(username, username)

            registration_result = user_manager.register_user(username, password, username)
            if registration_result["success"]:
                home_path = f"/home/{username}"
                # Create directory as root
                fs_manager.create_directory(home_path, {"name": "root", "group": "root"})
                # Change ownership to the new user
                fs_manager.chown(home_path, username)
                fs_manager.chgrp(home_path, username)
                return {
                    "success": True,
                    "output": f"User '{username}' registered. Home directory created at /home/{username}.",
                    "effect": "sync_user_state",
                    "users": user_manager.get_all_users()
                }
            else:
                return registration_result
        except IndexError:
            return {"success": False, "error": "useradd: malformed password lines from stdin"}
    else:
        # If no piped password, trigger the interactive flow
        return {
            "effect": "useradd",
            "username": username
        }


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