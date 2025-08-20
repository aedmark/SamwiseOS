# gem/core/commands/rename.py
from filesystem import fs_manager
import os

def define_flags():
    return {
        'flags': [],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    """ This command only renames files within the current directory. """
    if len(args) != 2:
        return {
            "success": False,
            "error": {
                "message": "rename: missing operand",
                "suggestion": "Usage: rename OLD_NAME NEW_NAME"
            }
        }

    old_name, new_name = args[0], args[1]

    if '/' in old_name or '/' in new_name:
        return {
            "success": False,
            "error": {
                "message": "rename: invalid argument",
                "suggestion": "Use 'mv' to move files across directories."
            }
        }

    try:
        current_path = fs_manager.current_path
        old_abs_path = os.path.join(current_path, old_name)
        new_abs_path = os.path.join(current_path, new_name)

        fs_manager.rename_node(old_abs_path, new_abs_path)
        return "" # Success
    except FileNotFoundError:
        return {
            "success": False,
            "error": {
                "message": f"rename: cannot find '{old_name}'",
                "suggestion": "The source file does not exist in the current directory."
            }
        }
    except FileExistsError:
        return {
            "success": False,
            "error": {
                "message": f"rename: cannot create file '{new_name}': File exists",
                "suggestion": "A file with the new name already exists."
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "rename: an unexpected error occurred",
                "suggestion": f"Details: {e}"
            }
        }


def man(args, flags, user_context, **kwargs):
    return """
NAME
    rename - rename a file

SYNOPSIS
    rename OLD_NAME NEW_NAME

DESCRIPTION
    Renames a file from OLD_NAME to NEW_NAME within the current directory.
    This command does not move files across directories. For that, use 'mv'.

OPTIONS
    This command takes no options.

EXAMPLES
    rename old_name.txt new_name.txt
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: rename <OLD_NAME> <NEW_NAME>"