# gem/core/commands/ls.py

from filesystem import fs_manager
from datetime import datetime
import os

def define_flags():
    return [
        {'name': 'long', 'short': 'l', 'long': 'long', 'takes_value': False},
        {'name': 'all', 'short': 'a', 'long': 'all', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'long': 'recursive', 'takes_value': False},
        {'name': 'directory', 'short': 'd', 'long': 'directory', 'takes_value': False},
    ]

def _format_long(path, name, node):
    mode = node.get('mode', 0)
    type_char_map = {"directory": "d", "file": "-", "symlink": "l"}
    type_char = type_char_map.get(node.get('type'), '-')
    perms = "".join(['r' if (mode >> (8-i)) & 1 else '-' for i in range(9)])
    full_perms = type_char + perms
    owner = node.get('owner', 'root').ljust(8)
    group = node.get('group', 'root').ljust(8)
    size = str(len(node.get('content', '')) if node.get('type') == 'file' else 0).rjust(6)
    try:
        mtime_dt = datetime.fromisoformat(node.get('mtime', '').replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"

    display_name = f"{name} -> {node.get('target', '')}" if node.get('type') == 'symlink' else name
    return f"{full_perms} 1 {owner} {group} {size} {mtime_formatted} {display_name}"

def run(args, flags, user_context, **kwargs):
    paths = args if args else ["."]
    output = []
    error_lines = []

    for path in paths:
        # For 'ls -l', we want info about the link itself, not the target.
        # So we tell get_node NOT to resolve the final component if it's a link.
        node = fs_manager.get_node(path, resolve_symlink=not flags.get('long'))

        if not node:
            error_lines.append(f"ls: cannot access '{path}': No such file or directory")
            continue

        if node.get('type') == 'directory' and not flags.get('directory'):
            if len(paths) > 1:
                output.append(f"\n{path}:")

            children_names = sorted(node.get('children', {}).keys())
            if not flags.get('all'):
                children_names = [name for name in children_names if not name.startswith('.')]

            for name in children_names:
                child_node = node['children'][name]
                if flags.get('long'):
                    output.append(_format_long(path, name, child_node))
                else:
                    output.append(name)
        else:
            if flags.get('long'):
                output.append(_format_long(os.path.dirname(path), os.path.basename(path), node))
            else:
                output.append(path)

    if error_lines:
        return {"success": False, "error": "\n".join(error_lines)}

    return "\n".join(output)

def man(args, flags, user_context, **kwargs):
    return "NAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls [-a] [-l] [-R] [-d] [FILE...]"

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ls - list directory contents

SYNOPSIS
    ls [-a] [-l] [-R] [-t] [-S] [-X] [-r] [-d] [-1] [FILE...]

DESCRIPTION
    List information about the FILEs (the current directory by default).

    -l              use a long listing format
    -a, --all       do not ignore entries starting with .
    -R, --recursive list subdirectories recursively
    -t              sort by modification time, newest first
    -S              sort by file size, largest first
    -X              sort alphabetically by extension
    -r, --reverse   reverse order while sorting
    -d, --directory list directories themselves, not their contents
    -1              list one file per line
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ls [-a] [-l] [-R] [-t] [-S] [-X] [-r] [-d] [-1] [FILE...]"