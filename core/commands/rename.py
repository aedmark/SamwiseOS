# gem/core/commands/rename.py
from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Renames a file. A strict command that only renames files within the current directory.
    """
    if len(args) != 2:
        return {"success": False, "error": "rename: missing operand"}

    old_name = args[0]
    new_name = args[1]

    # A true 'rename' command should not handle file paths. It should only
    # rename a file in its current directory. The presence of a '/' indicates
    # an attempt to move a file, which should be handled by 'mv'.
    if '/' in old_name or '/' in new_name:
        return {"success": False, "error": "rename: invalid argument. Use 'mv' to move files across directories."}

    try:
        fs_manager.rename_node(old_name, new_name)
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
    Renames a file from OLD_NAME to NEW_NAME. This is a simplified command
    and does not move files across directories. For that, use 'mv'.
    Arguments for rename cannot contain path separators ('/').
"""

def help(args, flags, user_context, **kwargs):
    """
    Provides help information for the rename command.
    """
    return "Usage: rename [OLD_NAME] [NEW_NAME]"