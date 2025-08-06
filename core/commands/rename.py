# gem/core/commands/rename.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) != 2:
        return "rename: missing operand. Usage: rename <old_path> <new_path>"

    old_path, new_path = args

    try:
        # The core logic is already in our robust FileSystemManager
        fs_manager.rename_node(old_path, new_path)
        return ""  # Success
    except FileNotFoundError as e:
        return f"rename: {e}"
    except FileExistsError as e:
        return f"rename: {e}"
    except PermissionError as e:
        return f"rename: {e}"
    except Exception as e:
        return f"rename: an unexpected error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    rename - rename or move files and directories

SYNOPSIS
    rename OLD_PATH NEW_PATH

DESCRIPTION
    Renames OLD_PATH to NEW_PATH. If NEW_PATH is an existing directory,
    moves OLD_PATH into that directory.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: rename <old_path> <new_path>"