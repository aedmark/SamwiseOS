# gem/core/commands/mkdir.py
import os
from filesystem import fs_manager
from datetime import datetime

def run(args, flags, user_context):
    """
    Creates one or more new directories.
    """
    if not args:
        raise ValueError("mkdir: missing operand")

    create_parents = "-p" in flags
    now_iso = datetime.utcnow().isoformat() + "Z"
    changes_made = False

    for path_arg in args:
        full_path = fs_manager.get_absolute_path(path_arg)

        if fs_manager.get_node(full_path):
            if not create_parents:
                raise FileExistsError(f"mkdir: cannot create directory ‘{path_arg}’: File exists")
            continue

        parent_path = os.path.dirname(full_path)
        dir_name = os.path.basename(full_path)
        parent_node = fs_manager.get_node(parent_path)

        if not parent_node:
            if not create_parents:
                raise FileNotFoundError(f"mkdir: cannot create directory ‘{path_arg}’: No such file or directory")

            parts = parent_path.strip('/').split('/')
            current_path = ''
            for part in parts:
                current_path = f"{current_path}/{part}"
                if not fs_manager.get_node(current_path):
                    parent_of_current = os.path.dirname(current_path)
                    p_node = fs_manager.get_node(parent_of_current)
                    new_dir = {
                        "type": "directory", "children": {},
                        "owner": user_context.get('name', 'root'),
                        "group": user_context.get('name', 'root'),
                        "mode": 0o755, "mtime": now_iso
                    }
                    p_node['children'][part] = new_dir
                    changes_made = True
            parent_node = fs_manager.get_node(parent_path)

        if parent_node.get('type') != 'directory':
            raise NotADirectoryError(f"mkdir: cannot create directory ‘{path_arg}’: Not a directory")

        new_directory = {
            "type": "directory",
            "children": {},
            "owner": user_context.get('name', 'root'),
            "group": user_context.get('name', 'root'),
            "mode": 0o755,
            "mtime": now_iso
        }
        parent_node['children'][dir_name] = new_directory
        parent_node['mtime'] = now_iso
        changes_made = True

    if changes_made:
        fs_manager._save_state()

    return "" # No output on success