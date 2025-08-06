# gem/core/commands/rmdir.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if not args:
        return "rmdir: missing operand"

    for path in args:
        node = fs_manager.get_node(path)

        if not node:
            return f"rmdir: failed to remove '{path}': No such file or directory"

        if node.get('type') != 'directory':
            return f"rmdir: failed to remove '{path}': Not a directory"

        if node.get('children'):
            return f"rmdir: failed to remove '{path}': Directory not empty"

        try:
            fs_manager.remove(path)
        except Exception as e:
            return f"rmdir: failed to remove '{path}': {repr(e)}"

    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    rmdir - remove empty directories

SYNOPSIS
    rmdir DIRECTORY...

DESCRIPTION
    Removes the DIRECTORY(ies), if they are empty.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: rmdir DIRECTORY..."