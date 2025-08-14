# /core/commands/cp.py

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
        {'name': 'force', 'short': 'f', 'long': 'force', 'takes_value': False},
        {'name': 'confirmed', 'long': 'confirmed', 'takes_value': True, "hidden": True},
    ]

def _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, preserve=False):
    """Recursively copies a node. A deep copy is made to prevent reference issues."""
    now_iso = datetime.utcnow().isoformat() + "Z"

    new_node = {k: v for k, v in source_node.items()}
    new_node['mtime'] = now_iso

    if not preserve:
        new_node['owner'] = user_context.get('name', 'guest')
        new_node['group'] = user_context.get('group', 'guest')
        new_node['mode'] = source_node.get('mode', 0o644 if source_node['type'] == 'file' else 0o755)

    if new_node.get('type') == 'directory':
        new_node['children'] = {}
        for child_name, child_node in source_node.get('children', {}).items():
            _copy_node_recursive(child_node, new_node, child_name, user_context, preserve)

    dest_parent_node['children'][new_name] = new_node

def run(args, flags, user_context, **kwargs):
    stdin_data = kwargs.get('stdin_data') # Extract stdin_data from kwargs
    if len(args) < 2:
        return {"success": False, "error": "cp: missing destination file operand"}

    source_paths = args[:-1]
    dest_path_arg = args[-1]

    is_recursive = flags.get('recursive', False)
    is_preserve = flags.get('preserve', False)
    is_interactive = flags.get('interactive', False)
    is_force = flags.get('force', False)
    confirmed_path = flags.get("confirmed")
    is_pre_confirmed = stdin_data and stdin_data.strip().upper() == 'YES'

    dest_node = fs_manager.get_node(dest_path_arg)
    dest_is_dir = dest_node and dest_node.get('type') == 'directory'

    if len(source_paths) > 1 and not dest_is_dir:
        return {"success": False, "error": f"cp: target '{dest_path_arg}' is not a directory"}

    for source_path in source_paths:
        source_node = fs_manager.get_node(source_path)
        if not source_node:
            return {"success": False, "error": f"cp: cannot stat '{source_path}': No such file or directory"}

        if source_node.get('type') == 'directory' and not is_recursive:
            return {"success": False, "error": f"cp: -r not specified; omitting directory '{source_path}'"}

        final_dest_path = os.path.join(dest_path_arg, os.path.basename(source_path)) if dest_is_dir else dest_path_arg

        if is_interactive and not is_force and not is_pre_confirmed and fs_manager.get_node(final_dest_path) and confirmed_path != final_dest_path:
            return {
                "effect": "confirm",
                "message": [f"cp: overwrite '{final_dest_path}'?"],
                "on_confirm_command": f"cp {'-r ' if is_recursive else ''}{'-p ' if is_preserve else ''} --confirmed={shlex.quote(final_dest_path)} {shlex.quote(source_path)} {shlex.quote(dest_path_arg)}"
            }

        if is_force and fs_manager.get_node(final_dest_path):
            try:
                fs_manager.remove(final_dest_path, recursive=True)
            except Exception as e:
                return {"success": False, "error": f"cp: failed to remove existing destination: {repr(e)}"}


        try:
            if dest_is_dir:
                dest_parent_node = dest_node
                new_name = os.path.basename(source_path)
            else:
                dest_parent_path = os.path.dirname(dest_path_arg)
                dest_parent_node = fs_manager.get_node(dest_parent_path)
                new_name = os.path.basename(dest_path_arg)

            if not dest_parent_node or dest_parent_node.get('type') != 'directory':
                return {"success": False, "error": f"cp: cannot copy to '{dest_path_arg}': Not a directory"}

            _copy_node_recursive(source_node, dest_parent_node, new_name, user_context, is_preserve)
        except Exception as e:
            return {"success": False, "error": f"cp: an unexpected error occurred: {repr(e)}"}

    fs_manager._save_state()
    return ""

def man(args, flags, user_context, **kwargs):
    return """
NAME
    cp - copy files and directories

SYNOPSIS
    cp [OPTION]... SOURCE... DEST

DESCRIPTION
    Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.

    -f, --force
            if destination file cannot be opened, remove it and try again
    -i, --interactive
           prompt before overwrite
    -p, --preserve
           same as --preserve=mode,ownership,timestamps
    -r, -R, --recursive
           copy directories recursively
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: cp [OPTION]... SOURCE... DEST"