# gem/core/commands/clearfs.py
import os
from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Clears all files and directories from the current user's home directory
    after a confirmation prompt.
    """
    # This checks if the command is being run after the user has confirmed.
    if '--confirmed' in flags:
        return _perform_clear(user_context)

    username = user_context.get('name')

    if username == 'root':
        return {"success": False, "error": "clearfs: cannot clear the root user's home directory for safety."}

    home_path = f"/home/{username}"
    home_node = fs_manager.get_node(home_path)

    if home_node and home_node.get('type') == 'directory':
        # This effect will ask the JS side for confirmation.
        # If confirmed, it will re-run this same command with the '--confirmed' flag.
        return {
            "effect": "confirm",
            "message": [
                "WARNING: This will permanently delete all files and directories in your home folder.",
                "This action cannot be undone. Are you sure?",
            ],
            "on_confirm_command": "clearfs --confirmed"
        }

    return {"success": False, "error": "clearfs: Could not find home directory to clear."}

def _perform_clear(user_context):
    """The actual logic that runs after the user confirms."""
    username = user_context.get('name')
    home_path = f"/home/{username}"
    home_node = fs_manager.get_node(home_path)

    if home_node and home_node.get('type') == 'directory':
        home_node['children'] = {}
        home_node['mtime'] = datetime.utcnow().isoformat() + "Z"
        fs_manager._save_state()
        return "Home directory cleared."

    return {"success": False, "error": "clearfs: Something went wrong after confirmation."}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    clearfs - Clears all files and directories from the current user's home directory.

SYNOPSIS
    clearfs

DESCRIPTION
    The clearfs command removes all files and subdirectories within the
    current user's home directory, effectively resetting it to a clean slate.
    This command is useful for cleaning up test files or starting fresh without
    affecting other users on the system.
    
    WARNING: This operation is irreversible and will permanently delete all data from
    your home directory. The command will prompt for confirmation.
"""