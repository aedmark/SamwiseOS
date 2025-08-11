# gem/core/commands/chmod.py

from filesystem import fs_manager
import os
import re

def define_flags():
    """Declares the flags that the chmod command accepts."""
    return [
        {'name': 'recursive', 'short': 'R', 'long': 'recursive', 'takes_value': False},
    ]

def _chmod_recursive(path, mode_octal, user_context):
    """Recursively applies a mode to a directory and its contents."""
    node = fs_manager.get_node(path)
    if not node:
        return # Should not happen if called correctly

    # Change the mode of the current node
    node['mode'] = mode_octal
    node['mtime'] = fs_manager._get_current_iso_time()

    if node.get('type') == 'directory':
        for child_name, child_node in node.get('children', {}).items():
            child_path = os.path.join(path, child_name)
            _chmod_recursive(child_path, mode_octal, user_context)

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    if len(args) < 2:
        return "chmod: missing operand. Usage: chmod [-R] <mode> <path>..."

    mode_str = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    # Validate the mode string
    if not re.match(r'^[0-7]{3,4}$', mode_str):
        return f"chmod: invalid mode: ‘{mode_str}’"
    mode_octal = int(mode_str, 8)

    for path in paths:
        try:
            node = fs_manager.get_node(path)
            if not node:
                return f"chmod: cannot access '{path}': No such file or directory"

            if is_recursive and node.get('type') == 'directory':
                _chmod_recursive(path, mode_octal, user_context)
            else:
                fs_manager.chmod(path, mode_str)

        except Exception as e:
            return f"chmod: an unexpected error occurred on '{path}': {repr(e)}"

    fs_manager._save_state()
    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return """
NAME
    chmod - change file mode bits

SYNOPSIS
    chmod [-R] MODE FILE...

DESCRIPTION
    Changes the file mode bits of each given file according to mode,
    which can be an octal number.

    -R, --recursive
          change files and directories recursively
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return "Usage: chmod [-R] <mode> <path>..."