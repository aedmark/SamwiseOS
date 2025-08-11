# gem/core/commands/rm.py

from filesystem import fs_manager
import shlex
import os

def define_flags():
    """Declares the flags that the rm command accepts."""
    return [
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'force', 'short': 'f', 'long': 'force', 'takes_value': False},
        {'name': 'interactive', 'short': 'i', 'long': 'interactive', 'takes_value': False},
        # Internal flag for post-confirmation execution
        {'name': 'confirmed', 'long': 'confirmed', 'takes_value': True, 'hidden': True},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Removes files or directories with interactive and force options.
    """
    if not args:
        return "rm: missing operand"

    is_recursive = flags.get('recursive', False)
    is_force = flags.get('force', False)
    is_interactive = flags.get('interactive', False)
    confirmed_path = flags.get("confirmed")

    output_messages = []

    for path in args:
        abs_path = fs_manager.get_absolute_path(path)
        node = fs_manager.get_node(abs_path)

        if not node:
            if not is_force:
                output_messages.append(f"rm: cannot remove '{path}': No such file or directory")
            continue

        if node.get('type') == 'directory' and not is_recursive:
            output_messages.append(f"rm: cannot remove '{path}': Is a directory")
            continue

        if is_interactive and abs_path != confirmed_path:
            prompt_type = "directory" if node.get('type') == 'directory' else "regular file"
            return {
                "effect": "confirm",
                "message": [f"rm: remove {prompt_type} '{path}'?"],
                "on_confirm_command": f"rm {'-r ' if is_recursive else ''}{'-f ' if is_force else ''} --confirmed={shlex.quote(abs_path)} {shlex.quote(path)}"
            }

        try:
            fs_manager.remove(abs_path, recursive=True)
        except Exception as e:
            if not is_force:
                output_messages.append(f"rm: cannot remove '{path}': {repr(e)}")

    fs_manager._save_state()
    return "\n".join(output_messages)


def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    rm - remove files or directories

SYNOPSIS
    rm [OPTION]... [FILE]...

DESCRIPTION
    Removes each specified file. By default, it does not remove directories.

    -f, --force
          ignore nonexistent files and arguments, never prompt
    -i
          prompt before every removal
    -r, -R, --recursive
          remove directories and their contents recursively
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: rm [OPTION]... [FILE]..."