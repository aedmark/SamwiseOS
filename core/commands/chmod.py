# gem/core/commands/chmod.py

from filesystem import fs_manager
import os
import re
from datetime import datetime


def define_flags():
    """Declares the flags that the chmod command accepts."""
    return [
        {'name': 'recursive', 'short': 'R', 'long': 'recursive', 'takes_value': False},
    ]

def _chmod_recursive(path, mode_octal, user_context):
    """Recursively applies a mode to a directory and its contents."""
    node = fs_manager.get_node(path)
    if not node:
        return

    # Security Check: Only the owner or root can change permissions.
    if user_context.get('name') != 'root' and node.get('owner') != user_context.get('name'):
        # Silently skip if no permission, as chmod often does in recursive runs.
        return

    now_iso = datetime.utcnow().isoformat() + "Z"
    node['mode'] = mode_octal
    node['mtime'] = now_iso

    if node.get('type') == 'directory':
        for child_name in node.get('children', {}).keys():
            child_path = os.path.join(path, child_name)
            child_node = node['children'][child_name]
            # Pass the child node to the recursive call
            _chmod_recursive_helper(child_path, child_node, mode_octal, user_context)

def _chmod_recursive_helper(path, node, mode_octal, user_context):
    """Helper to avoid re-fetching nodes in recursion."""
    if user_context.get('name') != 'root' and node.get('owner') != user_context.get('name'):
        return

    now_iso = datetime.utcnow().isoformat() + "Z"
    node['mode'] = mode_octal
    node['mtime'] = now_iso

    if node.get('type') == 'directory':
        for child_name, child_node in node.get('children', {}).items():
            child_path = os.path.join(path, child_name)
            _chmod_recursive_helper(child_path, child_node, mode_octal, user_context)


def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {
            "success": False,
            "error": {
                "message": "chmod: missing operand.",
                "suggestion": "Try 'chmod <mode> <file_or_directory>'."
            }
        }

    mode_str = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    if not re.match(r'^[0-7]{3,4}$', mode_str):
        return {
            "success": False,
            "error": {
                "message": f"chmod: invalid mode: ‘{mode_str}’",
                "suggestion": "Mode should be an octal number like '755' or '644'."
            }
        }
    mode_octal = int(mode_str, 8)

    for path in paths:
        try:
            node = fs_manager.get_node(path)
            if not node:
                return {
                    "success": False,
                    "error": {
                        "message": f"chmod: cannot access '{path}': No such file or directory",
                        "suggestion": "Please verify the file path is correct."
                    }
                }

            # Security Check: Only the owner or root can change permissions.
            if user_context.get('name') != 'root' and node.get('owner') != user_context.get('name'):
                return {
                    "success": False,
                    "error": {
                        "message": f"chmod: changing permissions of '{path}': Operation not permitted",
                        "suggestion": "Only the file owner or root can change permissions."
                    }
                }

            if is_recursive and node.get('type') == 'directory':
                _chmod_recursive(path, mode_octal, user_context)
            else:
                fs_manager.chmod(path, mode_str)

        except Exception as e:
            return {
                "success": False,
                "error": {
                    "message": f"chmod: an unexpected error occurred on '{path}': {repr(e)}",
                    "suggestion": "Please check the file path and system permissions."
                }
            }

    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    chmod - change file mode bits

SYNOPSIS
    chmod [-R] MODE FILE...

DESCRIPTION
    Changes the file mode bits of each given file according to mode,
    which can be an octal number. Only the file owner or root may change
    the mode.

    -R, --recursive
          change files and directories recursively
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the chmod command."""
    return "Usage: chmod [-R] <mode> <path>..."