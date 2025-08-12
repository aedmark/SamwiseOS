# gem/core/commands/ls.py

from filesystem import fs_manager
from datetime import datetime
import os

def define_flags():
    """Declares the flags that the ls command accepts."""
    return [
        {'name': 'long', 'short': 'l', 'long': 'long', 'takes_value': False},
        {'name': 'all', 'short': 'a', 'long': 'all', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'long': 'recursive', 'takes_value': False},
        {'name': 'sort-time', 'short': 't', 'takes_value': False},
        {'name': 'sort-size', 'short': 'S', 'takes_value': False},
        {'name': 'sort-extension', 'short': 'X', 'takes_value': False},
        {'name': 'reverse', 'short': 'r', 'long': 'reverse', 'takes_value': False},
        {'name': 'directory', 'short': 'd', 'long': 'directory', 'takes_value': False},
    ]

def _format_long(path, name, node):
    """Formats a single line for the long listing format."""
    mode = node.get('mode', 0)
    type_char = {"directory": "d", "file": "-", "symlink": "l"}.get(node.get('type'), '-')
    perms = f"{type_char}{''.join(['r' if (mode >> i) & 1 else '-' for i in range(8, -1, -1)])}"

    owner = node.get('owner', 'root').ljust(8)
    group = node.get('group', 'root').ljust(8)
    size = str(fs_manager.calculate_node_size(os.path.join(path, name))).rjust(6)
    mtime_str = node.get('mtime', '')
    try:
        mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"

    display_name = f"{name} -> {node.get('target', '')}" if node.get('type') == 'symlink' else name
    return f"{perms} 1 {owner} {group} {size} {mtime_formatted} {display_name}"

def _get_sort_key(flags, path):
    """Returns a key function for sorting based on flags."""
    def get_ext(p): return os.path.splitext(p)[1]
    if flags.get('sort-time'): return lambda name: fs_manager.get_node(os.path.join(path, name)).get('mtime', '')
    if flags.get('sort-size'): return lambda name: fs_manager.calculate_node_size(os.path.join(path, name))
    if flags.get('sort-extension'): return lambda name: (get_ext(name), name)
    return lambda name: name.lower()

def _list_directory(path, flags, output):
    """Helper to list a single directory's contents."""
    node = fs_manager.get_node(path)
    if not node or node.get('type') != 'directory':
        return

    children_names = sorted(node.get('children', {}).keys())
    if not flags.get('all'):
        children_names = [name for name in children_names if not name.startswith('.')]

    sort_key_func = _get_sort_key(flags, path)
    sorted_children = sorted(children_names, key=sort_key_func, reverse=flags.get('reverse', False))

    if flags.get('long'):
        for name in sorted_children:
            output.append(_format_long(path, name, node['children'][name]))
    else:
        output.append("  ".join(sorted_children))

def run(args, flags, user_context, **kwargs):
    paths = args if args else ["."]
    output, file_args, dir_args, error_lines = [], [], [], []

    for path in paths:
        target_path = fs_manager.get_absolute_path(path)
        node = fs_manager.get_node(target_path, resolve_symlink=not flags.get('long'))
        if not node:
            error_lines.append(f"ls: cannot access '{path}': No such file or directory")
            continue
        if node.get('type') != 'directory' or flags.get('directory'):
            file_args.append((path, target_path, node))
        else:
            dir_args.append((path, target_path, node))

    if file_args:
        sorted_files = sorted(file_args, key=lambda x: _get_sort_key(flags, os.path.dirname(x[1]))(os.path.basename(x[1])), reverse=flags.get('reverse', False))
        if flags.get('long'):
            for _, target_path, node in sorted_files:
                output.append(_format_long(os.path.dirname(target_path), os.path.basename(target_path), node))
        else:
            output.append("  ".join([p[0].rstrip('/') for p in sorted_files]))

    if dir_args:
        if file_args: output.append("")
        sorted_dirs = sorted(dir_args, key=lambda x: x[0], reverse=flags.get('reverse', False))
        for i, (path, target_path, node) in enumerate(sorted_dirs):
            if len(paths) > 1:
                if i > 0 or file_args: output.append("")
                output.append(f"{path}:")
            _list_directory(target_path, flags, output)

    final_output = error_lines + output
    if error_lines:
        return {"success": False, "error": "\\n".join(final_output)}
    return "\\n".join(final_output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ls - list directory contents

SYNOPSIS
    ls [-a] [-l] [-R] [-t] [-S] [-X] [-r] [-d] [FILE...]

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
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ls [-a] [-l] [-R] [-t] [-S] [-X] [-r] [-d] [FILE...]"