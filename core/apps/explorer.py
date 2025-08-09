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
        root_node = fs_manager.get_node("/")

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
            "treeData": root_node,
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


# This will be instantiated in the kernel
explorer_manager = ExplorerManager()