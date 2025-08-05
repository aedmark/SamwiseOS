# gem/core/filesystem.py

import json
from datetime import datetime
import os

class FileSystemManager:
    def __init__(self):
        self.fs_data = {}
        self.current_path = "/"
        self.save_function = None  # To hold the save function from JS
        self._initialize_default_filesystem()

    def set_save_function(self, func):
        """Accepts the save function from the kernel to break the direct dependency on JS."""
        self.save_function = func

    def _save_state(self):
        """Internal method to safely call the provided save function."""
        if self.save_function:
            self.save_function(self.save_state_to_json())
        else:
            # This will appear in the browser console if something is wrong.
            print("CRITICAL: Filesystem save function not provided. Changes will not be persisted.")

    def set_context(self, current_path):
        """Sets the current working directory from the JS side."""
        self.current_path = current_path if current_path else "/"

    def get_absolute_path(self, target_path):
        """Resolves a path to its absolute form."""
        if not target_path: # Handle empty or None path
            target_path = "."
        if os.path.isabs(target_path):
            return os.path.normpath(target_path)
        return os.path.normpath(os.path.join(self.current_path, target_path))

    def _initialize_default_filesystem(self):
        """Initializes a default file system structure if one doesn't exist."""
        now_iso = datetime.utcnow().isoformat() + "Z"
        self.fs_data = {
            "/": {
                "type": "directory",
                "children": {},
                "owner": "root",
                "group": "root",
                "mode": 0o755,
                "mtime": now_iso,
            }
        }

    def get_node(self, path):
        """Retrieves a node from the filesystem using its absolute or relative path."""
        abs_path = self.get_absolute_path(path) # Always resolve to absolute path first
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
        """Loads the entire filesystem state from a JSON string."""
        try:
            self.fs_data = json.loads(json_string)
            return True
        except json.JSONDecodeError:
            self._initialize_default_filesystem()
            return False

    def save_state_to_json(self):
        """Serializes the entire filesystem state to a JSON string."""
        return json.dumps(self.fs_data)

    def write_file(self, path, content, user_context):
        """Creates or updates a file with new content."""
        abs_path = self.get_absolute_path(path)
        parent_path = os.path.dirname(abs_path)
        file_name = os.path.basename(abs_path)
        parent_node = self.get_node(parent_path)

        if not parent_node or parent_node.get('type') != 'directory':
            raise FileNotFoundError(f"Cannot create file in '{parent_path}': No such directory.")

        now_iso = datetime.utcnow().isoformat() + "Z"
        existing_file_node = parent_node['children'].get(file_name)

        if existing_file_node:
            # --- THIS IS THE FIX ---
            # Instead of modifying a retrieved node, modify it directly in its parent.
            if existing_file_node.get('type') != 'file':
                raise IsADirectoryError(f"Cannot write to '{path}': It is a directory.")

            parent_node['children'][file_name]['content'] = content
            parent_node['children'][file_name]['mtime'] = now_iso
            # -----------------------
        else:
            # This logic for creating a new file was already correct!
            new_file = {
                "type": "file",
                "content": content,
                "owner": user_context.get('name', 'guest'),
                "group": user_context.get('name', 'guest'),
                "mode": 0o644,
                "mtime": now_iso
            }
            parent_node['children'][file_name] = new_file

        parent_node['mtime'] = now_iso
        self._save_state()

    def remove(self, path, recursive=False):
        """Removes a file or directory."""
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

# Singleton instance to be used across the Python environment
fs_manager = FileSystemManager()