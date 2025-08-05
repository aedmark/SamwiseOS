# gem/core/commands/touch.py
import os
from filesystem import fs_manager
from datetime import datetime

def run(args, flags, user_context):
    """
    Changes file timestamps or creates empty files.
    """
    if not args:
        raise ValueError("touch: missing file operand")

    no_create = "-c" in flags
    now_iso = datetime.utcnow().isoformat() + "Z"
    changes_made = False

    for path_arg in args:
        full_path = fs_manager.get_absolute_path(path_arg)
        node = fs_manager.get_node(full_path)

        if node:
            # File exists, just update timestamp
            node['mtime'] = now_iso
            changes_made = True
        elif not no_create:
            # File does not exist, create it
            parent_path = os.path.dirname(full_path)
            file_name = os.path.basename(full_path)
            parent_node = fs_manager.get_node(parent_path)

            if not parent_node or parent_node.get('type') != 'directory':
                raise FileNotFoundError(f"touch: cannot touch '{path_arg}': No such file or directory")

            new_file = {
                "type": "file",
                "content": "",
                "owner": user_context.get('name', 'root'),
                "group": user_context.get('name', 'root'),
                "mode": 0o644,
                "mtime": now_iso
            }
            parent_node['children'][file_name] = new_file
            parent_node['mtime'] = now_iso
            changes_made = True

    if changes_made:
        fs_manager._save_state()

    return "" # No output on success