# gem/core/commands/rmdir.py

from filesystem import fs_manager
import os

def define_flags():
    """Declares the flags that the rmdir command accepts."""
    return [
        {'name': 'parents', 'short': 'p', 'long': 'parents', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if not args:
        return "rmdir: missing operand"

    is_parents = flags.get('parents', False)
    error_occurred = False

    for path in args:
        abs_path = fs_manager.get_absolute_path(path)

        try:
            # First, try to remove the specified directory
            node = fs_manager.get_node(abs_path)
            if not node:
                return f"rmdir: failed to remove '{path}': No such file or directory"
            if node.get('type') != 'directory':
                return f"rmdir: failed to remove '{path}': Not a directory"
            if node.get('children'):
                return f"rmdir: failed to remove '{path}': Directory not empty"

            fs_manager.remove(abs_path)

            # If -p is specified, try to remove parents
            if is_parents:
                parent_path = os.path.dirname(abs_path)
                while parent_path != '/':
                    parent_node = fs_manager.get_node(parent_path)
                    if parent_node and not parent_node.get('children'):
                        fs_manager.remove(parent_path)
                        parent_path = os.path.dirname(parent_path)
                    else:
                        # Stop if parent is not empty or doesn't exist
                        break
        except Exception as e:
            error_occurred = True
            return f"rmdir: failed to remove '{path}': {repr(e)}"

    fs_manager._save_state()
    return "" if not error_occurred else "rmdir: an error occurred during operation"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    rmdir - remove empty directories

SYNOPSIS
    rmdir [-p] DIRECTORY...

DESCRIPTION
    Removes the DIRECTORY(ies), if they are empty.

    -p, --parents
          remove DIRECTORY and its ancestors. For instance,
          `rmdir -p a/b/c` is similar to `rmdir a/b/c a/b a`.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: rmdir [-p] DIRECTORY..."