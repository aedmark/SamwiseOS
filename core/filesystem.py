import json
from datetime import datetime
import os

class FileSystemManager:
    # ... (init, set_context, get_absolute_path, _initialize_default_filesystem, get_node are unchanged) ...
    def __init__(self):
        self.fs_data = {}
        self.current_path = "/"
        self._initialize_default_filesystem()

    def set_context(self, current_path):
        """Sets the current working directory from the JS side."""
        self.current_path = current_path if current_path else "/"

    def get_absolute_path(self, target_path):
        """Resolves a path to its absolute form."""
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
        """Retrieves a node from the filesystem by its absolute path."""
        abs_path = os.path.normpath(path)
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
            print("Python FileSystemManager: State loaded from JSON.")
            return True
        except json.JSONDecodeError:
            print("Python FileSystemManager: Error decoding JSON, initializing new FS.")
            self._initialize_default_filesystem()
            return False

    def save_state_to_json(self):
        """Serializes the entire filesystem state to a JSON string."""
        return json.dumps(self.fs_data)

    def write_file(self, path, content, user_context):
        """Creates or updates a file with new content."""
        abs_path = self.get_absolute_path(path)
        node = self.get_node(abs_path)
        now_iso = datetime.utcnow().isoformat() + "Z"

        if node:
            if node.get('type') != 'file':
                raise IsADirectoryError(f"Cannot write to '{path}': It is a directory.")
            node['content'] = content
            node['mtime'] = now_iso
        else:
            parent_path = os.path.dirname(abs_path)
            file_name = os.path.basename(abs_path)
            parent_node = self.get_node(parent_path)

            if not parent_node or parent_node.get('type') != 'directory':
                raise FileNotFoundError(f"Cannot create file in '{parent_path}': No such directory.")

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

        # After any write, we should trigger a save back to JS/IndexedDB
        from pyodide.ffi import to_js
        import js
        js.save_fs_js(self.save_state_to_json())

# Singleton instance to be used across the Python environment
fs_manager = FileSystemManager()