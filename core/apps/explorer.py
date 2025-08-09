# gem/core/apps/explorer.py

import os
from filesystem import fs_manager

class ExplorerManager:
    """Manages the state and logic for the graphical file explorer."""
    def __init__(self):
        self.current_path = "/"
        self.expanded_paths = {"/"}
        self.move_operation = {"active": False, "sourcePath": None}

    def get_view_data(self, path, user_context):
        """Gathers all necessary data to render a view in the explorer."""
        self.current_path = path

        # Instead of sending the raw fs_manager node, we build a clean tree
        # with permission data included.
        def build_tree_with_perms(node, current_path):
            can_read = fs_manager.has_permission(current_path, user_context, "read")
            tree_node = {
                "type": node.get("type"),
                "canRead": can_read,
                "children": {}
            }
            if can_read and node.get('type') == 'directory':
                for name, child in sorted(node.get('children', {}).items()):
                    if child.get('type') == 'directory':
                        child_path = fs_manager.get_absolute_path(os.path.join(current_path, name))
                        tree_node['children'][name] = build_tree_with_perms(child, child_path)
            return tree_node

        root_fs_node = fs_manager.get_node("/")
        tree_data = build_tree_with_perms(root_fs_node, "/") if root_fs_node else {}

        main_node = fs_manager.get_node(path)
        items = []
        if main_node and fs_manager.has_permission(path, user_context, "read"):
            children = sorted(main_node.get('children', {}).keys())
            for name in children:
                child_node = main_node['children'][name]
                child_path = fs_manager.get_absolute_path(os.path.join(path, name))
                items.append({
                    "name": name,
                    "path": child_path,
                    "type": child_node.get('type'),
                    "node": child_node,
                    "size": fs_manager.calculate_node_size(child_path)
                })

        return {
            "currentPath": self.current_path,
            "treeData": tree_data, # Send the new, clean tree data
            "mainPaneItems": items,
            "expandedPaths": list(self.expanded_paths)
        }

    def toggle_tree_expansion(self, path):
        """Toggles the expansion state of a directory in the tree view."""
        if path in self.expanded_paths:
            self.expanded_paths.remove(path)
        else:
            self.expanded_paths.add(path)
        # Also expand all parents of the toggled path
        parent = path
        while parent and parent != '/':
            self.expanded_paths.add(parent)
            parent = os.path.dirname(parent) if os.path.dirname(parent) != parent else None

    def create_node(self, path, name, node_type, user_context):
        """Creates a new file or directory."""
        full_path = fs_manager.get_absolute_path(os.path.join(path, name))
        if fs_manager.get_node(full_path):
            raise FileExistsError(f"'{name}' already exists in this location.")

        if node_type == 'directory':
            fs_manager.create_directory(full_path, user_context)
        else: # 'file'
            fs_manager.write_file(full_path, '', user_context)
        return {"success": True, "path": full_path}

    def rename_node(self, old_path, new_name, user_context):
        """Renames a file or directory."""
        parent_dir = os.path.dirname(old_path)
        new_path = fs_manager.get_absolute_path(os.path.join(parent_dir, new_name))

        if fs_manager.get_node(new_path):
            raise FileExistsError(f"'{new_name}' already exists.")

        fs_manager.rename_node(old_path, new_path)
        return {"success": True}

    def delete_node(self, path, user_context):
        """Deletes a file or directory."""
        node = fs_manager.get_node(path)
        if not node:
            raise FileNotFoundError("Item to delete was not found.")

        is_recursive = node.get('type') == 'directory'
        fs_manager.remove(path, recursive=is_recursive)
        return {"success": True}


# This will be instantiated in the kernel
explorer_manager = ExplorerManager()