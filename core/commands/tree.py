# gem/core/commands/tree.py

import os
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the tree command accepts."""
    return [
        {'name': 'level', 'short': 'L', 'long': 'level', 'takes_value': True},
        {'name': 'dirs-only', 'short': 'd', 'long': 'dirs-only', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    path_arg = args[0] if args else "."
    start_path = fs_manager.get_absolute_path(path_arg)
    start_node = fs_manager.get_node(start_path)

    if not start_node:
        return {"success": False, "error": f"tree: '{path_arg}' [error opening dir]"}
    if start_node.get('type') != 'directory':
        return {"success": False, "error": f"tree: '{path_arg}' is not a directory."}

    try:
        max_depth = int(flags.get('level')) if flags.get('level') else float('inf')
    except (ValueError, TypeError):
        return {"success": False, "error": "tree: Invalid level, must be an integer."}

    dirs_only = flags.get('dirs-only', False)
    output, dir_count, file_count = [path_arg], 0, 0

    def build_tree(node, prefix="", current_depth=0):
        nonlocal dir_count, file_count
        if current_depth >= max_depth: return

        children = sorted(node.get('children', {}).keys())
        for i, name in enumerate(children):
            child_node = node['children'][name]
            is_last = (i == len(children) - 1)
            connector = "└── " if is_last else "├── "
            new_prefix = prefix + ("    " if is_last else "│   ")

            if child_node.get('type') == 'directory':
                dir_count += 1
                output.append(f"{prefix}{connector}{name}")
                build_tree(child_node, new_prefix, current_depth + 1)
            elif not dirs_only:
                file_count += 1
                output.append(f"{prefix}{connector}{name}")

    build_tree(start_node)

    summary = f"\\n{dir_count} director{'y' if dir_count == 1 else 'ies'}"
    if not dirs_only: summary += f", {file_count} file{'s' if file_count != 1 else ''}"
    output.append(summary)

    return "\\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    tree - list contents of directories in a tree-like format

SYNOPSIS
    tree [-d] [-L level] [DIRECTORY]

DESCRIPTION
    Recursively displays the directory structure of a given path.

    -d
          List directories only.
    -L level
          Descend only level directories deep.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: tree [-d] [-L level] [DIRECTORY]"