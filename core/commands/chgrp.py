# gem/core/commands/chgrp.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the chgrp command accepts."""
    return {
        'flags': [
            {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
            {'name': 'recursive', 'short': 'R', 'takes_value': False}, # Alias for recursive
        ],
        'metadata': {}
    }


def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 2:
        return {
            "success": False,
            "error": {
                "message": "chgrp: missing operand",
                "suggestion": "Try 'chgrp <group> <file_or_directory>'."
            }
        }

    new_group = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    if groups is None or new_group not in groups:
        return {
            "success": False,
            "error": {
                "message": f"chgrp: invalid group: '{new_group}'",
                "suggestion": "You can list all groups with the 'groups' command or create one with 'sudo groupadd'."
            }
        }

    for path in paths:
        try:
            # Security check is handled within fs_manager.chgrp
            fs_manager.chgrp(path, new_group, recursive=is_recursive)
        except PermissionError as e:
            return {
                "success": False,
                "error": {
                    "message": f"chgrp: changing group of '{path}': {e}",
                    "suggestion": "Only the root user can change the group ownership of files."
                }
            }
        except FileNotFoundError:
            return {
                "success": False,
                "error": {
                    "message": f"chgrp: cannot access '{path}': No such file or directory",
                    "suggestion": "Please verify the file path is correct."
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "message": f"chgrp: an unexpected error occurred on '{path}': {repr(e)}",
                    "suggestion": "Please check the file path and system permissions."
                }
            }

    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    chgrp - change group ownership

SYNOPSIS
    chgrp [OPTION]... GROUP FILE...

DESCRIPTION
    Changes the group ownership of each given FILE to GROUP. The user running the command must be root.

OPTIONS
    -R, -r, --recursive
          Operate on files and directories recursively.

EXAMPLES
    chgrp developers /home/project_alpha
    chgrp -R staff /home/shared_docs
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: chgrp [-R] <group> <path>..."