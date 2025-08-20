# gem/core/commands/chown.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the chown command accepts."""
    return {
        'flags': [
            {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
            {'name': 'recursive', 'short': 'R', 'takes_value': False}, # Alias for recursive
        ],
        'metadata': {}
    }


def run(args, flags, user_context, stdin_data=None, users=None, **kwargs):
    if len(args) < 2:
        return {
            "success": False,
            "error": {
                "message": "chown: missing operand",
                "suggestion": "Try 'chown <owner> <file_or_directory>'."
            }
        }

    new_owner = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    if users and new_owner not in users:
        return {
            "success": False,
            "error": {
                "message": f"chown: invalid user: '{new_owner}'",
                "suggestion": "You can see a list of all users with the 'listusers' command."
            }
        }

    for path in paths:
        try:
            # Security check is handled within fs_manager.chown
            fs_manager.chown(path, new_owner, recursive=is_recursive)
        except PermissionError as e:
            return {
                "success": False,
                "error": {
                    "message": f"chown: changing ownership of '{path}': {e}",
                    "suggestion": "Only the root user can change the ownership of files."
                }
            }
        except FileNotFoundError:
            return {
                "success": False,
                "error": {
                    "message": f"chown: cannot access '{path}': No such file or directory",
                    "suggestion": "Please verify the file path is correct."
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "message": f"chown: an unexpected error occurred on '{path}': {repr(e)}",
                    "suggestion": "Please check the file path and system permissions."
                }
            }

    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    chown - change file owner

SYNOPSIS
    chown [OPTION]... OWNER FILE...

DESCRIPTION
    Changes the user ownership of each given FILE to OWNER. This command can only be run by the root user.

OPTIONS
    -R, -r, --recursive
          Operate on files and directories recursively.

EXAMPLES
    chown guest /home/guest/data.txt
    chown -R guest /home/guest/projects
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: chown [-R] <owner> <path>..."