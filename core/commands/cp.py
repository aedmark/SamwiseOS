# gem/core/commands/cp.py

import os
from filesystem import fs_manager
from datetime import datetime
import shlex

def define_flags():
    """Declares the flags that the cp command accepts."""
    return [
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'takes_value': False},
        {'name': 'preserve', 'short': 'p', 'long': 'preserve', 'takes_value': False},
        {'name': 'interactive', 'short': 'i', 'long': 'interactive', 'takes_value': False},
        {'name': 'confirmed', 'long': 'confirmed', 'takes_value': True, "hidden": True},
    ]

def _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, preserve=False):
    """Recursively copies a node."""
    now_iso = datetime.utcnow().isoformat() + "Z"

    new_node = {k: v for k, v in source_node.items()}

    if not preserve:
        new_node['owner'] = user_context.get('name', 'guest')
        new_node['group'] = user_context.get('group', 'guest')
        new_node['mode'] = 0o644 if new_node['type'] == 'file' else 0o755

    new_node['mtime'] = now_iso

    if new_node.get('type') == 'directory':
        new_node['children'] = {}
        for child_name, child_node in source_node.get('children', {}).items():
            _copy_node_recursive(child_node, new_node, child_name, user_context, preserve)

    dest_parent_node['children'][new_name] = new_node

def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {"success": False, "error": "cp: missing destination file operand"}

    source_paths = args[:-1]
    dest_path_arg = args[-1]

    is_recursive = flags.get('recursive', False)
    is_preserve = flags.get('preserve', False)
    is_interactive = flags.get('interactive', False)
    confirmed_path = flags.get("confirmed")

    dest_node = fs_manager.get_node(dest_path_arg)

    if len(source_paths) > 1 and (not dest_node or dest_node.get('type') != 'directory'):
        return {"success": False, "error": f"cp: target '{dest_path_arg}' is not a directory"}

    for source_path in source_paths:
        source_node = fs_manager.get_node(source_path)
        if not source_node:
            return {"success": False, "error": f"cp: cannot stat '{source_path}': No such file or directory"}

        if source_node.get('type') == 'directory' and not is_recursive:
            return {"success": False, "error": f"cp: -r not specified; omitting directory '{source_path}'"}

        dest_parent_path = dest_path_arg if dest_node and dest_node.get('type') == 'directory' else os.path.dirname(dest_path_arg)
        dest_parent_node = fs_manager.get_node(dest_parent_path)

        if not dest_parent_node:
            return {"success": False, "error": f"cp: cannot create regular file '{dest_path_arg}': No such file or directory"}

        new_name = os.path.basename(source_path) if dest_node and dest_node.get('type') == 'directory' else os.path.basename(dest_path_arg)

        final_dest_path = os.path.join(dest_parent_path, new_name)

        if is_interactive and fs_manager.get_node(final_dest_path) and confirmed_path != final_dest_path:
            return {
                "effect": "confirm",
                "message": [f"cp: overwrite '{final_dest_path}'?"],
                "on_confirm_command": f"cp {'-r ' if is_recursive else ''}{'-p ' if is_preserve else ''} --confirmed={shlex.quote(final_dest_path)} {shlex.quote(source_path)} {shlex.quote(dest_path_arg)}"
            }

        _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, is_preserve)

    fs_manager._save_state()
    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    cp - copy files and directories

SYNOPSIS
    cp [OPTION]... SOURCE... DEST

DESCRIPTION
    Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.

    -i, --interactive
           prompt before overwrite
    -p, --preserve
           same as --preserve=mode,ownership,timestamps
    -r, -R, --recursive
           copy directories recursively
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: cp [OPTION]... SOURCE... DEST"