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

    for path_arg in args:
        full_path = fs_manager.get_absolute_path(path_arg)

        # Check if it already exists
        if fs_manager.get_node(full_path):
            if not create_parents:
                raise FileExistsError(f"mkdir: cannot create directory ‘{path_arg}’: File exists")
            continue # If -p is used and it exists, it's not an error

        parent_path = os.path.dirname(full_path)
        dir_name = os.path.basename(full_path)

        parent_node = fs_manager.get_node(parent_path)

        if not parent_node:
            if not create_parents:
                raise FileNotFoundError(f"mkdir: cannot create directory ‘{path_arg}’: No such file or directory")

            # Recursively create parents
            parts = parent_path.strip('/').split('/')
            current_path = ''
            for part in parts:
                current_path = f"{current_path}/{part}"
                if not fs_manager.get_node(current_path):
                    # This part needs the full user/group managers to be ported to be perfect,
                    # for now we'll use the current user context.
                    parent_of_current = os.path.dirname(current_path)
                    p_node = fs_manager.get_node(parent_of_current)
                    new_dir = {
                        "type": "directory", "children": {},
                        "owner": user_context.get('name', 'root'),
                        "group": user_context.get('name', 'root'),
                        "mode": 0o755, "mtime": now_iso
                    }
                    p_node['children'][part] = new_dir
            # After creating parents, the parent_node is now the one we need
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

    return "" # No output on success