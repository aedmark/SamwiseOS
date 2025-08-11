# gem/core/commands/rename.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Renames a source file to a destination. Fails if the destination is an existing directory.
    """
    if len(args) != 2:
        return {"success": False, "error": help(args, flags, user_context)}

    old_path = args[0]
    new_path = args[1]

    # Check if the destination is an existing directory
    dest_node = fs_manager.get_node(new_path)
    if dest_node and dest_node.get('type') == 'directory':
        return {"success": False, "error": f"rename: cannot overwrite directory '{new_path}'"}

    try:
        # The core logic is already in our robust FileSystemManager
        fs_manager.rename_node(old_path, new_path)
        return ""  # Success
    except FileNotFoundError:
        return {"success": False, "error": f"rename: cannot rename '{old_path}': No such file or directory"}
    except FileExistsError:
        return {"success": False, "error": f"rename: cannot create file '{new_path}': File exists"}
    except Exception as e:
        return {"success": False, "error": f"rename: an unexpected error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    rename - rename a file

SYNOPSIS
    rename OLD_PATH NEW_PATH

DESCRIPTION
    Renames OLD_PATH to NEW_PATH. Unlike 'mv', this command will not move a
    file into a directory. It is used exclusively for renaming.
"""

def help(args, flags, user_context, **kwargs):
    """
    Provides help information for the rename command.
    """
    return "Usage: rename <old_path> <new_path>"