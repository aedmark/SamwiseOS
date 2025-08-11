# gem/core/commands/ls.py

from filesystem import fs_manager
from datetime import datetime
import json
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
        # This is the crucial addition:
        {'name': 'directory', 'short': 'd', 'long': 'directory', 'takes_value': False},
    ]

def _format_long(path, name, node):
    """Formats a single line for the long listing format."""
    perms = "d" if node.get('type') == 'directory' else "-"
    perms += "rwx" * 3
    owner = node.get('owner', 'root').ljust(8)
    group = node.get('group', 'root').ljust(8)
    size = str(fs_manager.calculate_node_size(os.path.join(path, name))).rjust(6)
    mtime_str = node.get('mtime', '')
    try:
        mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"
    return f"{perms} 1 {owner} {group} {size} {mtime_formatted} {name}"

def _get_sort_key(flags, path):
    """Returns a key function for sorting based on flags."""
    def get_ext(p): return os.path.splitext(p)[1]
    if flags.get('sort-time'):
        return lambda name: fs_manager.get_node(os.path.join(path, name)).get('mtime', '')
    if flags.get('sort-size'):
        return lambda name: fs_manager.calculate_node_size(os.path.join(path, name))
    if flags.get('sort-extension'):
        return lambda name: (get_ext(name), name)
    return lambda name: name.lower()

def _list_directory(path, flags, user_context, output, is_recursive_call=False):
    """Helper to list a single directory's contents."""
    node = fs_manager.get_node(path)
    if not node or node.get('type') != 'directory':
        if not is_recursive_call:
            output.append(f"ls: cannot access '{path}': No such file or directory or not a directory")
        return
    if is_recursive_call or (len(output) > 0 and output[-1]):
        output.append(f"\n{path}:")
    children_names = sorted(node.get('children', {}).keys())
    if not flags.get('all'):
        children_names = [name for name in children_names if not name.startswith('.')]
    sort_key_func = _get_sort_key(flags, path)
    sorted_children = sorted(children_names, key=sort_key_func, reverse=flags.get('reverse', False))
    if flags.get('long'):
        for name in sorted_children:
            child_node = node['children'][name]
            output.append(_format_long(path, name, child_node))
    else:
        output.append("  ".join(sorted_children))
    if flags.get('recursive'):
        for name in sorted_children:
            child_path = os.path.join(path, name)
            child_node = fs_manager.get_node(child_path)
            if child_node and child_node.get('type') == 'directory':
                _list_directory(child_path, flags, user_context, output, True)

def run(args, flags, user_context, stdin_data=None):
    """
    Lists the contents of directories with various sorting and formatting options.
    """
    paths = args if args else ["."]
    output = []
    error_occurred = False

    # This check is vital for the diag.sh script to work correctly.
    if len(paths) == 1 and not fs_manager.get_node(fs_manager.get_absolute_path(paths[0])):
        return {"success": False, "error": f"ls: cannot access '{paths[0]}': No such file or directory"}

    for i, path in enumerate(paths):
        target_path = fs_manager.get_absolute_path(path)
        node = fs_manager.get_node(target_path)

        if not node:
            output.append(f"ls: cannot access '{path}': No such file or directory")
            error_occurred = True
            continue

        # This logic handles the -d flag by treating directories like files.
        is_dir_as_file = flags.get('directory') and node.get('type') == 'directory'

        if node.get('type') == 'file' or is_dir_as_file:
            if flags.get('long'):
                output.append(_format_long(os.path.dirname(target_path), os.path.basename(target_path), node))
            else:
                output.append(path.rstrip('/'))
        elif node.get('type') == 'directory':
            if len(paths) > 1:
                if i > 0: output.append("")
                output.append(f"{path}:")
            _list_directory(target_path, flags, user_context, output, is_recursive_call=(len(paths) > 1))

    if error_occurred:
        return {"success": False, "error": "\n".join(output)}

    return "\n".join(output)


def man(args, flags, user_context, stdin_data=None):
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

def help(args, flags, user_context, stdin_data=None):
    return "Usage: ls [-a] [-l] [-R] [-t] [-S] [-X] [-r] [-d] [FILE...]"