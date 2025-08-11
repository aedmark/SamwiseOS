# gem/core/commands/ls.py

from filesystem import fs_manager
from datetime import datetime
import json

def define_flags():
    """Declares the flags that the ls command accepts."""
    return [
        {'name': 'long', 'short': 'l', 'long': 'long', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Lists the contents of a directory.
    Supports a '-l' flag for a long listing format.
    """
    path = args[0] if args else "."
    target_path = fs_manager.get_absolute_path(path)
    node = fs_manager.get_node(target_path)

    if not node:
        return f"ls: cannot access '{path}': No such file or directory"

    if node.get('type') != 'directory':
        return path # If it's a file, just list the file itself

    # If we are here, node is a directory
    children = sorted(node.get('children', {}).keys())

    if flags.get('long', False):
        output = []
        for name in children:
            child_node = node['children'][name]
            # Format permissions, owner, group, size, date, and name
            perms = "d" if child_node.get('type') == 'directory' else "-"
            # This is a simplified permission model for now
            perms += "rwx" * 3

            owner = child_node.get('owner', 'root').ljust(8)
            group = child_node.get('group', 'root').ljust(8)

            # Rough size calculation for content
            size = str(len(child_node.get('content', '')) if child_node.get('type') == 'file' else 4096).rjust(6)

            mtime_str = child_node.get('mtime', '')
            try:
                # Parse ISO format and reformat to 'Month Day HH:MM'
                mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
                mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
            except ValueError:
                mtime_formatted = "Jan 01 00:00"

            output.append(f"{perms} 1 {owner} {group} {size} {mtime_formatted} {name}")
        return "\n".join(output)
    else:
        # Simple listing
        return "  ".join(children)

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the ls command.
    """
    return """
NAME
    ls - list directory contents

SYNOPSIS
    ls [-l] [FILE...]

DESCRIPTION
    List information about the FILEs (the current directory by default).
    Sort entries alphabetically.

    -l, --long
          use a long listing format, showing permissions, owner, size,
          and modification date.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the ls command.
    """
    return "Usage: ls [-l] [DIRECTORY]"