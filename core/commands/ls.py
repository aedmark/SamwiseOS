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

    size_val = len(node.get('target', '').encode('utf-8')) if node.get('type') == 'symlink' else fs_manager.calculate_node_size(os.path.join(path, name))
    size = str(size_val).rjust(6)

    mtime_str = node.get('mtime', '')
    try:
        mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"

    # And display the target for symlinks.
    display_name = f"{name} -> {node.get('target', '')}" if node.get('type') == 'symlink' else name
    return f"{full_perms} 1 {owner} {group} {size} {mtime_formatted} {display_name}"

def _format_columns(items, terminal_width=80):
    """Formats a list of strings into columns."""
    if not items:
        return ""

    max_len = max(len(item) for item in items)
    col_width = max_len + 2  # Add padding

    num_cols = max(1, terminal_width // col_width)
    num_rows = (len(items) + num_cols - 1) // num_cols

    # Pad all items to the same width for alignment
    padded_items = [item.ljust(col_width) for item in items]

    output = []
    for r in range(num_rows):
        row_items = []
        for c in range(num_cols):
            index = c * num_rows + r
            if index < len(padded_items):
                row_items.append(padded_items[index])
        output.append("".join(row_items).rstrip())

    return "\n".join(output)


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
    children_names = list(node.get('children', {}).keys())
    if not flags.get('all'):
        children_names = [name for name in children_names if not name.startswith('.')]

    sort_key_func = _get_sort_key(flags, path)
    sorted_children = sorted(children_names, key=sort_key_func, reverse=flags.get('reverse', False))

    output = []
    if flags.get('long'):
        for name in sorted_children:
            output.append(_format_long(path, name, node['children'][name]))
    elif flags.get('one-per-line'):
        output.extend(sorted_children)
    else:
        # The new columnar formatting!
        formatted_columns = _format_columns(sorted_children)
        if formatted_columns:
            output.append(formatted_columns)

    return output, []

def run(args, flags, user_context, **kwargs):
    paths = args if args else ["."]
    output = []
    error_lines = []
    file_args = []
    dir_args = []

    for path in paths:
        target_path = fs_manager.get_absolute_path(path)
        resolve_symlink_for_get_node = not (flags.get('long') and fs_manager.get_node(target_path, resolve_symlink=False).get('type') == 'symlink')
        node = fs_manager.get_node(target_path, resolve_symlink=resolve_symlink_for_get_node)
        if not node:
            error_lines.append(f"ls: cannot access '{path}': No such file or directory")
            continue
        if node.get('type') == 'directory' and not flags.get('directory'):
            dir_args.append((path, target_path, node))
        else:
            file_args.append((path, target_path, node))

    if file_args:
        sorted_files = sorted(file_args, key=lambda x: _get_sort_key(flags, os.path.dirname(x[1]))(os.path.basename(x[1])), reverse=flags.get('reverse', False))
        if flags.get('long'):
            for _, target_path, node in sorted_files:
                output.append(_format_long(os.path.dirname(target_path), os.path.basename(target_path), node))
        elif flags.get('one-per-line'):
            output.extend([p[0] for p in sorted_files])
        else:
            output.append(_format_columns([p[0] for p in sorted_files]))

    if dir_args:
        if file_args: output.append("")
        sorted_dirs = sorted(dir_args, key=lambda x: x[0], reverse=flags.get('reverse', False))

        def recursive_lister(current_path_display, current_path_abs, current_node):
            if len(paths) > 1 or flags.get('recursive'):
                output.append(f"\n{current_path_display}:")
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