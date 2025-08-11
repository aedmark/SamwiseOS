# gem/core/commands/rm.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the rm command accepts."""
    return [
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Removes files or directories.
    Requires '-r' or '--recursive' flag to remove directories.
    """
    if not args:
        return help(args, flags, user_context)

    is_recursive = flags.get('recursive', False)
    output_messages = []

    for path in args:
        try:
            node = fs_manager.get_node(path)
            if not node:
                output_messages.append(f"rm: cannot remove '{path}': No such file or directory")
                continue

            if node.get('type') == 'directory' and not is_recursive:
                output_messages.append(f"rm: cannot remove '{path}': Is a directory")
                continue

            # The underlying fs_manager function handles the actual removal logic
            fs_manager.remove(path, recursive=is_recursive)

        except Exception as e:
            output_messages.append(f"rm: an unexpected error occurred with '{path}': {repr(e)}")

    return "\n".join(output_messages)

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the rm command.
    """
    return """
NAME
    rm - remove files or directories

SYNOPSIS
    rm [OPTION]... [FILE]...

DESCRIPTION
    Removes each specified file. By default, it does not remove directories.

    -r, -R, --recursive
          remove directories and their contents recursively

AUTHOR
    Built with love by the Pawnee-SamwiseOS Unification Committee.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the rm command.
    """
    return "Usage: rm [-r] [FILE...]"