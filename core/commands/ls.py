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
        {'name': 'one-per-line', 'short': '1', 'takes_value': False},
    ]

def _format_long(path, name, node):
    """Formats a single line for the long listing format."""
    mode = node.get('mode', 0)
    type_char_map = {"directory": "d", "file": "-", "symlink": "l"}
    type_char = type_char_map.get(node.get('type'), '-')

    perms = ""
    for i in range(2, -1, -1):
        section = (mode >> (i * 3)) & 7
        perms += 'r' if (section & 4) else '-'
        perms += 'w' if (section & 2) else '-'
        perms += 'x' if (section & 1) else '-'

    full_perms = type_char + perms
    owner = node.get('owner', 'root').ljust(8)
    group = node.get('group', 'root').ljust(8)

    # For symlinks, size is the length of the target path string
    size_val = len(node.get('target', '').encode('utf-8')) if node.get('type') == 'symlink' else fs_manager.calculate_node_size(os.path.join(path, name))
    size = str(size_val).rjust(6)

    mtime_str = node.get('mtime', '')
    try:
        mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"

    display_name = f"{name} -> {node.get('target', '')}" if node.get('type') == 'symlink' else name
    return f"{full_perms} 1 {owner} {group} {size} {mtime_formatted} {display_name}"

def _get_sort_key(flags, path):
    """Returns a key function for sorting based on flags."""
    def get_ext(p): return os.path.splitext(p)[1]
    if flags.get('sort-time'): return lambda name: fs_manager.get_node(os.path.join(path, name)).get('mtime', '')
    if flags.get('sort-size'): return lambda name: fs_manager.calculate_node_size(os.path.join(path, name))
    if flags.get('sort-extension'): return lambda name: (get_ext(name), name)
    return lambda name: name.lower()

def _list_directory_contents(path, flags, user_context):
    """
    Lists the contents of a single directory. Returns a tuple of (content_lines, error_lines).
    This function contains the core listing logic.
    """
    node = fs_manager.get_node(path)
    # The calling function should have already checked permissions.

    children_names = sorted(node.get('children', {}).keys())
    if not flags.get('all'):
        children_names = [name for name in children_names if not name.startswith('.')]

    sort_key_func = _get_sort_key(flags, path)
    sorted_children = sorted(children_names, key=sort_key_func, reverse=flags.get('reverse', False))

    output = []
    if flags.get('long'):
        for name in sorted_children:
            output.append(_format_long(path, name, node['children'][name]))
    else:
        if sorted_children:
            separator = "\n" if flags.get('one-per-line') else "  "
            output.append(separator.join(sorted_children))

    return output, []


def run(args, flags, user_context, **kwargs):
    paths = args if args else ["."]
    output = []
    error_lines = []

    file_args = []
    dir_args = []

    # 1. Separate arguments into files and directories, and check for existence.
    for path in paths:
        target_path = fs_manager.get_absolute_path(path)
        # Use resolve_symlink=False for -l to show link info, not target info.
        resolve_symlink_for_get_node = not (flags.get('long') and os.path.islink(target_path))
        node = fs_manager.get_node(target_path, resolve_symlink=resolve_symlink_for_get_node)

        if not node:
            error_lines.append(f"ls: cannot access '{path}': No such file or directory")
            continue

        if node.get('type') == 'directory' and not flags.get('directory'):
            dir_args.append((path, target_path, node))
        else:
            file_args.append((path, target_path, node))

    # 2. Process all file arguments first.
    if file_args:
        # Sort files based on the same criteria as directory contents.
        # The 'path' for sorting is the parent directory of the file.
        sorted_files = sorted(file_args, key=lambda x: _get_sort_key(flags, os.path.dirname(x[1]))(os.path.basename(x[1])), reverse=flags.get('reverse', False))

        if flags.get('long'):
            for _, target_path, node in sorted_files:
                output.append(_format_long(os.path.dirname(target_path), os.path.basename(target_path), node))
        else:
            separator = "\n" if flags.get('one-per-line') else "  "
            output.append(separator.join([p[0] for p in sorted_files]))

    # 3. Process all directory arguments.
    if dir_args:
        if file_args: output.append("") # Add a newline between files and directories

        sorted_dirs = sorted(dir_args, key=lambda x: x[0], reverse=flags.get('reverse', False))

        def recursive_lister(current_path_display, current_path_abs, current_node):
            # This is our robust recursive helper function!
            if len(paths) > 1 or flags.get('recursive'):
                output.append(f"\n{current_path_display}:")

            # *** Centralized Permission Check ***
            if not fs_manager.has_permission(current_path_abs, user_context, 'read'):
                error_lines.append(f"ls: cannot open directory '{current_path_display}': Permission denied")
                return

            content_lines, errors = _list_directory_contents(current_path_abs, flags, user_context)
            output.extend(content_lines)
            error_lines.extend(errors)

            if flags.get('recursive'):
                children = sorted(current_node.get('children', {}).keys())
                for child_name in children:
                    child_node = current_node['children'][child_name]
                    if child_node.get('type') == 'directory':
                        child_display_path = os.path.join(current_path_display, child_name)
                        child_abs_path = os.path.join(current_path_abs, child_name)
                        recursive_lister(child_display_path, child_abs_path, child_node)

        for i, (path, target_path, node) in enumerate(sorted_dirs):
            if i > 0 and not (len(paths) > 1 or flags.get('recursive')):
                output.append("")
            recursive_lister(path, target_path, node)

    # 4. Finalize output and return status.
    final_output_str = "\n".join(output)
    final_error_str = "\n".join(error_lines)

    if error_lines:
        full_message = f"{final_error_str}\n{final_output_str}".strip()
        return {"success": False, "error": full_message}

    return final_output_str

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