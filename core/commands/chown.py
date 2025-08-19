# gem/core/commands/chown.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the chown command accepts."""
    return {
        'flags': [
            {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
            {'name': 'recursive', 'short': 'R', 'takes_value': False},
        ],
        'metadata': {
            'root_required': True
        }
    }


def run(args, flags, user_context, stdin_data=None, users=None, **kwargs):
    if len(args) < 2:
        return {"success": False, "error": "chown: missing operand. Usage: chown [-R] <owner> <path>..."}

    new_owner = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    if users and new_owner not in users:
        return {"success": False, "error": f"chown: invalid user: '{new_owner}'"}

    for path in paths:
        try:
            fs_manager.chown(path, new_owner, recursive=is_recursive)
        except FileNotFoundError:
            return {"success": False, "error": f"chown: cannot access '{path}': No such file or directory"}
        except Exception as e:
            return {"success": False, "error": f"chown: an unexpected error occurred on '{path}': {repr(e)}"}

    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    chown - change file owner

SYNOPSIS
    chown [OPTION]... OWNER FILE...

DESCRIPTION
    Changes the user ownership of each given FILE to OWNER.

    -R, -r, --recursive
          operate on files and directories recursively
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: chown [-R] <owner> <path>..."