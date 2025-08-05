# gem/core/filesystem.py

import json
from datetime import datetime
import os

class FileSystemManager:
    def __init__(self):
        self.fs_data = {}
        self.current_path = "/"
        self.save_function = None
        self._initialize_default_filesystem()

    def set_save_function(self, func):
        self.save_function = func

    def _save_state(self):
        if self.save_function:
            self.save_function(self.save_state_to_json())
        else:
            print("CRITICAL: Filesystem save function not provided.")

    def set_context(self, current_path):
        self.current_path = current_path if current_path else "/"

    def get_absolute_path(self, target_path):
        if not target_path:
            target_path = "."
        if os.path.isabs(target_path):
            return os.path.normpath(target_path)
        return os.path.normpath(os.path.join(self.current_path, target_path))

    def _initialize_default_filesystem(self):
        now_iso = datetime.utcnow().isoformat() + "Z"
        self.fs_data = {
            "/": {
                "type": "directory", "children": {}, "owner": "root",
                "group": "root", "mode": 0o755, "mtime": now_iso,
            }
        }

    def get_node(self, path):
        abs_path = self.get_absolute_path(path)
        if abs_path == '/':
            return self.fs_data.get('/')
        parts = [part for part in abs_path.split('/') if part]
        node = self.fs_data.get('/')
        for part in parts:
            if node and node.get('type') == 'directory' and part in node.get('children', {}):
                node = node['children'][part]
            else:
                return None
        return node

    def load_state_from_json(self, json_string):
        try:
            self.fs_data = json.loads(json_string)
            return True
        except json.JSONDecodeError:
            self._initialize_default_filesystem()
            return False

    def save_state_to_json(self):
        return json.dumps(self.fs_data)

    def write_file(self, path, content, user_context):
        abs_path = self.get_absolute_path(path)
        parent_path = os.path.dirname(abs_path)
        file_name = os.path.basename(abs_path)
        parent_node = self.get_node(parent_path)

        if not parent_node or parent_node.get('type') != 'directory':
            raise FileNotFoundError(f"Cannot create file in '{parent_path}': No such directory.")

        now_iso = datetime.utcnow().isoformat() + "Z"
        if file_name in parent_node['children']:
            if parent_node['children'][file_name].get('type') != 'file':
                raise IsADirectoryError(f"Cannot write to '{path}': It is a directory.")
            parent_node['children'][file_name]['content'] = content
            parent_node['children'][file_name]['mtime'] = now_iso
        else:
            new_file = {
                "type": "file", "content": content, "owner": user_context.get('name', 'guest'),
                "group": user_context.get('name', 'guest'), "mode": 0o644, "mtime": now_iso
            }
            parent_node['children'][file_name] = new_file

        parent_node['mtime'] = now_iso
        self._save_state()

    def create_directory(self, path, user_context):
        """Creates a new directory."""
        abs_path = self.get_absolute_path(path)
        parent_path = os.path.dirname(abs_path)
        dir_name = os.path.basename(abs_path)
        parent_node = self.get_node(parent_path)

        if not parent_node or parent_node.get('type') != 'directory':
            raise FileNotFoundError(f"Cannot create directory in '{parent_path}': No such directory.")

        if dir_name in parent_node['children']:
            raise FileExistsError(f"Cannot create directory '{path}': File exists.")

        now_iso = datetime.utcnow().isoformat() + "Z"
        new_dir = {
            "type": "directory", "children": {}, "owner": user_context.get('name', 'guest'),
            "group": user_context.get('name', 'guest'), "mode": 0o755, "mtime": now_iso
        }
        parent_node['children'][dir_name] = new_dir
        parent_node['mtime'] = now_iso
        self._save_state()

    def rename_node(self, old_path, new_path):
        """Renames or moves a file or directory."""
        abs_old_path = self.get_absolute_path(old_path)
        abs_new_path = self.get_absolute_path(new_path)

        if abs_old_path == '/':
            raise PermissionError("Cannot rename the root directory.")

        old_parent_path = os.path.dirname(abs_old_path)
        old_name = os.path.basename(abs_old_path)
        old_parent_node = self.get_node(old_parent_path)

        if not old_parent_node or old_name not in old_parent_node.get('children', {}):
            raise FileNotFoundError(f"Cannot rename '{old_path}': No such file or directory.")

        # Check if new_path is a directory; if so, move the node into it
        new_node_target = self.get_node(abs_new_path)
        if new_node_target and new_node_target.get('type') == 'directory':
            new_parent_node = new_node_target
            new_name = old_name
        else:
            new_parent_path = os.path.dirname(abs_new_path)
            new_name = os.path.basename(abs_new_path)
            new_parent_node = self.get_node(new_parent_path)

        if not new_parent_node or new_parent_node.get('type') != 'directory':
            raise FileNotFoundError(f"Target directory '{os.path.dirname(new_path)}' does not exist.")

        if new_name in new_parent_node.get('children', {}):
            raise FileExistsError(f"Cannot rename to '{new_path}': Destination already exists.")

        # Move the node and update timestamps
        now_iso = datetime.utcnow().isoformat() + "Z"
        node_to_move = old_parent_node['children'].pop(old_name)
        node_to_move['mtime'] = now_iso
        new_parent_node['children'][new_name] = node_to_move
        old_parent_node['mtime'] = now_iso
        new_parent_node['mtime'] = now_iso

        self._save_state()

    def remove(self, path, recursive=False):
        abs_path = self.get_absolute_path(path)
        if abs_path == '/':
            raise PermissionError("Cannot remove the root directory.")

        parent_path = os.path.dirname(abs_path)
        node_name = os.path.basename(abs_path)
        parent_node = self.get_node(parent_path)

        if not parent_node or node_name not in parent_node.get('children', {}):
            raise FileNotFoundError(f"Cannot remove '{path}': No such file or directory.")

        child_node = parent_node['children'][node_name]
        if child_node.get('type') == 'directory' and child_node.get('children') and not recursive:
            raise IsADirectoryError(f"Cannot remove '{path}': Directory not empty.")

        del parent_node['children'][node_name]
        parent_node['mtime'] = datetime.utcnow().isoformat() + "Z"
        self._save_state()
        return True

fs_manager = FileSystemManager()