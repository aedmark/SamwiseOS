import json
from datetime import datetime
import os # We'll use os for robust path manipulation

class FileSystemManager:
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

        # os.path.join handles the leading '/' correctly
        return os.path.normpath(os.path.join(self.current_path, target_path))

    def _initialize_default_filesystem(self):
        # ... (rest of the method is unchanged)
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
        # Use our new resolver to clean the path
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

# Singleton instance to be used across the Python environment
fs_manager = FileSystemManager()