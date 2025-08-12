# gem/core/commands/rename.py
from filesystem import fs_manager
import os

def define_flags():
    """Declares the flags that the rename command accepts."""
    return []

def run(args, flags, user_context, **kwargs):
    """
    Renames a file. This command only renames files within the current directory.
    """
    if len(args) != 2:
        return {"success": False, "error": "rename: missing operand. Usage: rename OLD_NAME NEW_NAME"}

    old_name, new_name = args[0], args[1]

    if '/' in old_name or '/' in new_name:
        return {"success": False, "error": "rename: invalid argument. Use 'mv' to move files across directories."}

    try:
        current_path = fs_manager.current_path
        old_abs_path = os.path.join(current_path, old_name)
        new_abs_path = os.path.join(current_path, new_name)

        fs_manager.rename_node(old_abs_path, new_abs_path)
        return "" # Success
    except FileNotFoundError:
        return {"success": False, "error": f"rename: cannot find '{old_name}'"}
    except FileExistsError:
        return {"success": False, "error": f"rename: cannot create file '{new_name}': File exists"}
    except Exception as e:
        return {"success": False, "error": f"An unexpected error occurred: {e}"}


def man(args, flags, user_context, **kwargs):
    """
    Displays the manual page for the rename command.
    """
    return """
NAME
    rename - rename a file

SYNOPSIS
    rename [OLD_NAME] [NEW_NAME]

DESCRIPTION
    Renames a file from OLD_NAME to NEW_NAME within the current directory.
    This command does not move files across directories. For that, use 'mv'.
"""

def help(args, flags, user_context, **kwargs):
    """
    Provides help information for the rename command.
    """
    return "Usage: rename [OLD_NAME] [NEW_NAME]"