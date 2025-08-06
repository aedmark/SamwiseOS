# gem/core/commands/cp.py

import os
from filesystem import fs_manager
from datetime import datetime

def _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, preserve=False):
    """Recursively copies a node."""
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Create a deep copy of the source to avoid modifying the original
    new_node = {k: v for k, v in source_node.items()}

    if not preserve:
        new_node['owner'] = user_context.get('name', 'guest')
        new_node['group'] = user_context.get('group', 'guest')
        new_node['mode'] = 0o644 if new_node['type'] == 'file' else 0o755

    new_node['mtime'] = now_iso

    if new_node.get('type') == 'directory':
        new_node['children'] = {} # Start with an empty children dict for the copy
        for child_name, child_node in source_node.get('children', {}).items():
            _copy_node_recursive(child_node, new_node, child_name, user_context, preserve)

    dest_parent_node['children'][new_name] = new_node

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 2:
        return "cp: missing destination file operand"

    source_paths = args[:-1]
    dest_path_arg = args[-1]

    is_recursive = "-r" in flags or "-R" in flags
    is_preserve = "-p" in flags

    dest_node = fs_manager.get_node(dest_path_arg)

    if len(source_paths) > 1 and (not dest_node or dest_node.get('type') != 'directory'):
        return f"cp: target '{dest_path_arg}' is not a directory"

    for source_path in source_paths:
        source_node = fs_manager.get_node(source_path)
        if not source_node:
            return f"cp: cannot stat '{source_path}': No such file or directory"

        if source_node.get('type') == 'directory' and not is_recursive:
            return f"cp: -r not specified; omitting directory '{source_path}'"

        dest_parent_path = dest_path_arg if dest_node and dest_node.get('type') == 'directory' else os.path.dirname(dest_path_arg)
        dest_parent_node = fs_manager.get_node(dest_parent_path)

        if not dest_parent_node:
            return f"cp: cannot create regular file '{dest_path_arg}': No such file or directory"

        new_name = os.path.basename(source_path) if dest_node and dest_node.get('type') == 'directory' else os.path.basename(dest_path_arg)

        _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, is_preserve)

    fs_manager._save_state()
    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    cp - copy files and directories

SYNOPSIS
    cp [OPTION]... SOURCE... DEST

DESCRIPTION
    Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.

    -p     same as --preserve=mode,ownership,timestamps
    -r, -R, --recursive
           copy directories recursively
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: cp [OPTION]... SOURCE... DEST"