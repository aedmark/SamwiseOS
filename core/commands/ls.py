# gem/core/commands/ls.py

from filesystem import fs_manager
from datetime import datetime
import os

def define_flags():
    """Declares the flags that the ls command accepts."""
    return {
        'flags': [
            {'name': 'long', 'short': 'l', 'long': 'long', 'takes_value': False},
            {'name': 'all', 'short': 'a', 'long': 'all', 'takes_value': False},
            {'name': 'recursive', 'short': 'R', 'long': 'recursive', 'takes_value': False},
            {'name': 'sort-time', 'short': 't', 'takes_value': False},
            {'name': 'sort-size', 'short': 'S', 'takes_value': False},
            {'name': 'sort-extension', 'short': 'X', 'takes_value': False},
            {'name': 'reverse', 'short': 'r', 'long': 'reverse', 'takes_value': False},
            {'name': 'directory', 'short': 'd', 'long': 'directory', 'takes_value': False},
            {'name': 'one-per-line', 'short': '1', 'takes_value': False},
        ],
        'metadata': {}
    }

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

    if node.get('type') == 'symlink':
        size_val = len(node.get('target', '').encode('utf-8'))
    elif node.get('type') == 'file':
        size_val = len(node.get('content', '').encode('utf-8'))
    else: # directory
        size_val = 4096 # A conventional size for directories

    size = str(size_val).rjust(6)

    mtime_str = node.get('mtime', '')
    try:
        mtime_dt = datetime.fromisoformat(mtime_str.replace('Z', '+00:00'))
        mtime_formatted = mtime_dt.strftime('%b %d %H:%M')
    except (ValueError, TypeError):
        mtime_formatted = "Jan 01 00:00"

    display_name = f"{name} -> {node.get('target', '')}" if node.get('type') == 'symlink' else name
    return f"{full_perms} 1 {owner} {group} {size} {mtime_formatted} {display_name}"

def _format_columns(items, terminal_width=80):
    """Formats a list of strings into columns."""
    if not items:
        return ""
    max_len = max(len(item) for item in items) if items else 0
    col_width = max_len + 2
    num_cols = max(1, terminal_width // col_width)
    num_rows = (len(items) + num_cols - 1) // num_cols
    padded_items = [item.ljust(col_width) for item in items]
    output = []
    for r in range(num_rows):
        row_items = [padded_items[c * num_rows + r] for c in range(num_cols) if c * num_rows + r < len(padded_items)]
        output.append("".join(row_items).rstrip())
    return "\n".join(output)

def _get_sort_key_for_node(flags):
    """Returns a key function for sorting nodes based on flags."""
    if flags.get('sort-time'): return lambda item: item[1].get('mtime', '')
    if flags.get('sort-size'):
        def size_key(item):
            node = item[1]
            if node.get('type') == 'symlink': return len(node.get('target', '').encode('utf-8'))
            if node.get('type') == 'file': return len(node.get('content', '').encode('utf-8'))
            return 4096
        return size_key
    if flags.get('sort-extension'): return lambda item: (os.path.splitext(item[0])[1], item[0].lower())
    return lambda item: item[0].lower()

def _list_directory_contents(path, flags, user_context, recursive_output, all_errors):
    """Recursively lists directory contents."""
    is_first_level = not recursive_output
    if not is_first_level:
        recursive_output.append(f"\n{path}:")

    # When listing contents, we MUST resolve the link to get the target directory
    node = fs_manager.get_node(path, resolve_symlink=True)

    if not node or node.get('type') != 'directory':
        all_errors.append(f"ls: cannot open directory '{path}': Not a directory")
        return

    # Permission check for reading the directory's contents
    if not fs_manager.has_permission(path, user_context, 'read'):
        # THE FIX IS HERE! Added 'f' to make this an f-string.
        all_errors.append(f"ls: cannot open directory '{path}': Permission denied")
        return

    children_items = list(node.get('children', {}).items())
    if not flags.get('all'):
        children_items = [item for item in children_items if not item[0].startswith('.')]

    sort_key_func = _get_sort_key_for_node(flags)
    sorted_children = sorted(children_items, key=sort_key_func, reverse=flags.get('reverse', False))

    dir_content = []
    sub_dirs_to_recurse = []

    if flags.get('long'):
        for name, child_node in sorted_children:
            dir_content.append(_format_long(path, name, child_node))
            if flags.get('recursive') and child_node.get('type') == 'directory':
                sub_dirs_to_recurse.append(os.path.join(path, name))
    elif flags.get('one-per-line'):
        for name, child_node in sorted_children:
            dir_content.append(name)
            if flags.get('recursive') and child_node.get('type') == 'directory':
                sub_dirs_to_recurse.append(os.path.join(path, name))
    else:
        names = [name for name, child_node in sorted_children]
        formatted_columns = _format_columns(names)
        if formatted_columns:
            dir_content.append(formatted_columns)
        for name, child_node in sorted_children:
            if flags.get('recursive') and child_node.get('type') == 'directory':
                sub_dirs_to_recurse.append(os.path.join(path, name))

    recursive_output.extend(dir_content)

    for sub_dir_path in sub_dirs_to_recurse:
        _list_directory_contents(sub_dir_path, flags, user_context, recursive_output, all_errors)


def run(args, flags, user_context, **kwargs):
    paths = args if args else ["."]
    output, error_lines, file_args, dir_args = [], [], [], []

    for path in paths:
        # Get the node itself, don't resolve symlinks yet
        node = fs_manager.get_node(path, resolve_symlink=False)
        if not node:
            error_lines.append(f"ls: cannot access '{path}': No such file or directory")
            continue

        # Determine if we should list the item itself or its contents
        should_list_contents = False
        if node.get('type') == 'directory' and not flags.get('directory'):
            should_list_contents = True
        elif node.get('type') == 'symlink' and not flags.get('directory'):
            resolved_node = fs_manager.get_node(path, resolve_symlink=True)
            if resolved_node and resolved_node.get('type') == 'directory':
                should_list_contents = True

        if should_list_contents:
            dir_args.append((path, node))
        else:
            file_args.append((path, node))

    if file_args:
        sort_key_func = _get_sort_key_for_node(flags)
        sorted_files = sorted(file_args, key=lambda x: sort_key_func((os.path.basename(x[0]), x[1])), reverse=flags.get('reverse', False))

        file_output = []
        if flags.get('long'):
            for path, node in sorted_files:
                file_output.append(_format_long(os.path.dirname(path), os.path.basename(path), node))
        elif flags.get('one-per-line'):
            file_output.extend([p[0] for p in sorted_files])
        else:
            file_output.append(_format_columns([p[0] for p in sorted_files]))
        output.extend(file_output)

    if dir_args:
        if file_args: output.append("")
        sorted_dirs = sorted(dir_args, key=lambda x: x[0], reverse=flags.get('reverse', False))

        for i, (path, node) in enumerate(sorted_dirs):
            if i > 0: output.append("")
            if len(paths) > 1:
                output.append(f"{path}:")

            dir_output = []
            _list_directory_contents(path, flags, user_context, dir_output, error_lines)
            output.extend(dir_output)

    final_output_str = "\n".join(output)
    if error_lines:
        return {"success": False, "error": {"message": "\n".join(error_lines), "suggestion": "Please check the file paths and permissions."}}

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