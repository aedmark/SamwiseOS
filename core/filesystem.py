# gem/core/filesystem.py

import json
from datetime import datetime
import os
import re

class FileSystemManager:
    def __init__(self):
        self.fs_data = {}
        self.current_path = "/"
        self.save_function = None
        self.user_groups = {} # Initialize the attribute
        self._initialize_default_filesystem()

    def set_save_function(self, func):
        self.save_function = func

    def _save_state(self):
        if self.save_function:
            self.save_function(self.save_state_to_json())
        else:
            print("CRITICAL: Filesystem save function not provided.")

    def set_context(self, current_path, user_groups=None):
        self.current_path = current_path if current_path else "/"
        # A simple way to pass group context from JS for permission checks
        self.user_groups = user_groups or {}

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
                "type": "directory", "children": {
                    "home": {"type": "directory", "children": {}, "owner": "root", "group": "root", "mode": 0o755, "mtime": now_iso},
                    "etc": {"type": "directory", "children": {
                        'sudoers': {"type": "file", "content": "# /etc/sudoers...", "owner": "root", "group": "root", "mode": 0o440, "mtime": now_iso}
                    }, "owner": "root", "group": "root", "mode": 0o755, "mtime": now_iso},
                    "var": {"type": "directory", "children": {
                        "log": {"type": "directory", "children": {}, "owner": "root", "group": "root", "mode": 0o755, "mtime": now_iso}
                    }, "owner": "root", "group": "root", "mode": 0o755, "mtime": now_iso},
                }, "owner": "root", "group": "root", "mode": 0o755, "mtime": now_iso,
            }
        }
        # Ensure root home exists on init
        self.create_directory("/home/root", {"name": "root", "group": "root"})


    def reset(self):
        """Resets the filesystem to a default state."""
        self._initialize_default_filesystem()
        self._save_state()

    def get_node(self, path, resolve_symlink=True):
        abs_path = self.get_absolute_path(path)

        # Fast path for root
        if abs_path == '/':
            return self.fs_data.get('/')

        parts = [part for part in abs_path.split('/') if part]
        node = self.fs_data.get('/')

        for i, part in enumerate(parts):
            if not node or node.get('type') != 'directory' or 'children' not in node or part not in node['children']:
                return None

            node = node['children'][part]

            # Resolve symlink if it's not the last part of the path, or if resolve_symlink is true
            if node.get('type') == 'symlink' and (resolve_symlink or i < len(parts) - 1):
                target_path = node.get('target', '')
                # To handle nested symlinks, we can recursively call get_node
                # This is a simplified implementation; a real one would need loop detection
                base_dir = os.path.dirname(self.get_absolute_path(os.path.join(abs_path, '..', part)))
                resolved_target = self.get_absolute_path(os.path.join(base_dir, target_path))
                node = self.get_node(resolved_target)

        return node

    def fsck(self, users, groups, repair=False):
        """Checks and optionally repairs the filesystem integrity."""
        report = []
        changes_made = False
        all_nodes = []

        def traverse(node, path):
            all_nodes.append((path, node))
            if node.get('type') == 'directory':
                for name, child in node.get('children', {}).items():
                    traverse(child, os.path.join(path, name))

        traverse(self.fs_data['/'], '/')

        existing_users = set(users.keys())
        existing_groups = set(groups.keys())

        for path, node in all_nodes:
            # Check 1: Orphaned files/dirs
            if node.get('owner') not in existing_users:
                report.append(f"Orphaned node found at {path} (owner '{node.get('owner')}' does not exist).")
                if repair:
                    node['owner'] = 'root'
                    report.append(f" -> Repaired: Set owner to 'root'.")
                    changes_made = True

            if node.get('group') not in existing_groups:
                report.append(f"Orphaned node found at {path} (group '{node.get('group')}' does not exist).")
                if repair:
                    node['group'] = 'root'
                    report.append(f" -> Repaired: Set group to 'root'.")
                    changes_made = True

            # Check 2: Dangling symlinks
            if node.get('type') == 'symlink':
                target_path = self.get_absolute_path(os.path.join(os.path.dirname(path), node.get('target')))
                if self.get_node(target_path) is None:
                    report.append(f"Dangling symlink found at {path} pointing to '{node.get('target')}'")
                    if repair:
                        # Simple repair: remove dangling link
                        parent_path = os.path.dirname(path)
                        parent_node = self.get_node(parent_path)
                        del parent_node['children'][os.path.basename(path)]
                        report.append(f" -> Repaired: Removed dangling link.")
                        changes_made = True

        # Check 3: User home directories
        home_dir_node = self.get_node("/home")
        for user in existing_users:
            if user not in home_dir_node.get('children', {}):
                report.append(f"User '{user}' is missing a home directory.")
                if repair:
                    self.create_directory(f"/home/{user}", {"name": user, "group": users[user].get('primaryGroup', user)})
                    self.chown(f"/home/{user}", user)
                    report.append(f" -> Repaired: Created /home/{user}.")
                    changes_made = True

        if changes_made:
            self._save_state()

        return report, changes_made


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

        existing_node = parent_node['children'].get(file_name)

        if existing_node:
            # File exists, check write permission on the file itself.
            if not self._check_permission(existing_node, user_context, 'write'):
                raise PermissionError(f"Permission denied to write to '{path}'")
        else:
            # File does not exist, check write permission on the parent directory.
            if not self._check_permission(parent_node, user_context, 'write'):
                raise PermissionError(f"Permission denied to create file in '{parent_path}'")

        now_iso = datetime.utcnow().isoformat() + "Z"
        if existing_node:
            if existing_node.get('type') != 'file':
                raise IsADirectoryError(f"Cannot write to '{path}': It is a directory.")
            existing_node['content'] = content
            existing_node['mtime'] = now_iso
        else:
            new_file = {
                "type": "file", "content": content, "owner": str(user_context.get('name', 'guest')),
                "group": str(user_context.get('group', 'guest')), "mode": 0o644, "mtime": now_iso
            }
            parent_node['children'][file_name] = new_file

        parent_node['mtime'] = now_iso
        self._save_state()

    def create_directory(self, path, user_context):
        """
        Creates a new directory, including any necessary parent directories.
        """
        abs_path = self.get_absolute_path(path)
        if self.get_node(abs_path):
            # Do nothing if it already exists, mimicking `mkdir -p`
            return

        parts = [part for part in abs_path.split('/') if part]
        current_node = self.fs_data.get('/')
        current_path_so_far = '/'
        now_iso = datetime.utcnow().isoformat() + "Z"

        for i, part in enumerate(parts):
            current_path_so_far = os.path.join(current_path_so_far, part)
            if part not in current_node.get('children', {}):
                # Special case: A user should be allowed to create their own home directory,
                # even without general write permissions on /home.
                is_creating_own_home_dir = (os.path.dirname(current_path_so_far) == '/home' and
                                            part == user_context.get('name'))

                # Check write permission on the parent, unless the special case applies.
                if not self._check_permission(current_node, user_context, 'write') and not is_creating_own_home_dir:
                    raise PermissionError(f"Permission denied to create directory in '{os.path.dirname(current_path_so_far)}'")

                new_dir = {
                    "type": "directory", "children": {}, "owner": str(user_context.get('name', 'guest')),
                    "group": str(user_context.get('group', 'guest')), "mode": 0o755, "mtime": now_iso
                }
                current_node['children'][part] = new_dir
                current_node['mtime'] = now_iso

            current_node = current_node['children'][part]

            if current_node.get('type') != 'directory':
                raise FileExistsError(f"Cannot create directory '{path}': A component '{part}' is a file.")

        self._save_state()


    def chmod(self, path, mode_str):
        """Changes the permission mode of a file or directory."""
        if not re.match(r'^[0-7]{3,4}$', mode_str):
            raise ValueError(f"Invalid mode: '{mode_str}'")

        node = self.get_node(path)
        if not node:
            raise FileNotFoundError(f"Cannot access '{path}': No such file or directory")

        node['mode'] = int(mode_str, 8)
        node['mtime'] = datetime.utcnow().isoformat() + "Z"
        self._save_state()

    def _recursive_chown(self, node, new_owner):
        """Helper for recursively changing ownership."""
        now_iso = datetime.utcnow().isoformat() + "Z"
        node['owner'] = new_owner
        node['mtime'] = now_iso
        if node.get('type') == 'directory' and node.get('children'):
            for child_node in node['children'].values():
                self._recursive_chown(child_node, new_owner)

    def chown(self, path, new_owner, recursive=False):
        """Changes the owner of a file or directory."""
        node = self.get_node(path)
        if not node:
            raise FileNotFoundError(f"Cannot access '{path}': No such file or directory")

        if recursive and node.get('type') == 'directory':
            self._recursive_chown(node, new_owner)
        else:
            node['owner'] = new_owner
            node['mtime'] = datetime.utcnow().isoformat() + "Z"

        self._save_state()

    def _recursive_chgrp(self, node, new_group):
        """Helper for recursively changing group ownership."""
        now_iso = datetime.utcnow().isoformat() + "Z"
        node['group'] = new_group
        node['mtime'] = now_iso
        if node.get('type') == 'directory' and node.get('children'):
            for child_node in node['children'].values():
                self._recursive_chgrp(child_node, new_group)

    def chgrp(self, path, new_group, recursive=False):
        """Changes the group of a file or directory."""
        node = self.get_node(path)
        if not node:
            raise FileNotFoundError(f"Cannot access '{path}': No such file or directory")

        if recursive and node.get('type') == 'directory':
            self._recursive_chgrp(node, new_group)
        else:
            node['group'] = new_group
            node['mtime'] = datetime.utcnow().isoformat() + "Z"

        self._save_state()

    def ln(self, target, link_name_arg, user_context):
        """Creates a symbolic link."""
        link_path = self.get_absolute_path(link_name_arg)
        link_name = os.path.basename(link_path)
        parent_path = os.path.dirname(link_path)

        parent_node = self.get_node(parent_path)
        if not parent_node or parent_node.get('type') != 'directory':
            raise FileNotFoundError(f"cannot create symbolic link '{link_name}': No such file or directory")

        if link_name in parent_node.get('children', {}):
            raise FileExistsError(f"cannot create symbolic link '{link_name}': File exists")

        # In a more complex system, we'd check write perms on parent_path
        # For now, we assume if the command gets this far, it's allowed.

        now_iso = datetime.utcnow().isoformat() + "Z"
        symlink_node = {
            "type": "symlink",
            "target": target,
            "owner": str(user_context.get('name', 'guest')),
            "group": str(user_context.get('group', 'guest')),
            "mode": 0o777, # Symlinks often have permissive modes
            "mtime": now_iso
        }

        parent_node['children'][link_name] = symlink_node
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

        now_iso = datetime.utcnow().isoformat() + "Z"

        # Explicitly remove the old entry before adding the new one.
        # This avoids any potential subtle bugs with dict.pop() when the source
        # and destination parent nodes are the same object.
        node_to_move = old_parent_node['children'][old_name]
        del old_parent_node['children'][old_name]

        node_to_move['mtime'] = now_iso
        new_parent_node['children'][new_name] = node_to_move

        old_parent_node['mtime'] = now_iso
        if old_parent_node is not new_parent_node:
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

    def _check_permission(self, node, user_context, permission_type):
        if user_context.get('name') == 'root':
            return True
        if not node:
            return False

        permission_map = {'read': 4, 'write': 2, 'execute': 1}
        required_perm = permission_map.get(permission_type)
        if not required_perm:
            return False

        mode = node.get('mode', 0)
        owner_perms = (mode >> 6) & 7
        group_perms = (mode >> 3) & 7
        other_perms = mode & 7

        if node.get('owner') == user_context.get('name'):
            return (owner_perms & required_perm) == required_perm

        user_groups = self.user_groups.get(user_context.get('name', ''), [])
        if node.get('group') in user_groups:
            return (group_perms & required_perm) == required_perm

        return (other_perms & required_perm) == required_perm

    def has_permission(self, path, user_context, permission_type):
        node = self.get_node(path)
        return self._check_permission(node, user_context, permission_type)

    def calculate_node_size(self, path):
        node = self.get_node(path)
        if not node:
            return 0
        if node.get('type') == 'file':
            return len(node.get('content', ''))
        if node.get('type') == 'directory':
            total_size = 0
            for child_name in node.get('children', {}):
                child_path = os.path.join(path, child_name)
                total_size += self.calculate_node_size(child_path)
            return total_size
        return 0

    def validate_path(self, path, user_context, options_json):
        """
        A robust path validator that checks for existence, type, and permissions
        for both the final node and all parent directories in the path.
        """
        options = json.loads(options_json)
        expected_type = options.get('expectedType')
        permissions_to_check = options.get('permissions', [])
        allow_missing = options.get('allowMissing', False)

        abs_path = self.get_absolute_path(path)
        parts = [part for part in abs_path.split('/') if part]

        # Start traversal from the root directory
        current_node_for_traversal = self.fs_data.get('/')
        current_path_for_traversal = '/'

        # Check traversal permissions on all parent directories of the target
        for part in parts[:-1]:
            if not self._check_permission(current_node_for_traversal, user_context, 'execute'):
                return {"success": False, "error": f"Permission denied: {current_path_for_traversal}"}

            # Descend to the next part of the path
            if 'children' not in current_node_for_traversal or part not in current_node_for_traversal['children']:
                return {"success": False, "error": "No such file or directory"}
            current_node_for_traversal = current_node_for_traversal['children'][part]
            current_path_for_traversal = os.path.join(current_path_for_traversal, part)

            if current_node_for_traversal.get('type') != 'directory':
                return {"success": False, "error": f"Not a directory: {current_path_for_traversal}"}

        # After the loop, `current_node_for_traversal` is the immediate parent of the target.
        # Now we can check the final target node.
        final_name = parts[-1] if parts else None
        final_node = None

        if final_name:
            # We need 'execute' permission on the PARENT to access children.
            if not self._check_permission(current_node_for_traversal, user_context, 'execute'):
                return {"success": False, "error": f"Permission denied: {current_path_for_traversal}"}
            final_node = current_node_for_traversal.get('children', {}).get(final_name)
        elif abs_path == '/':
            final_node = self.fs_data.get('/')
        else: # Should only happen for paths like '/home/'
            final_node = current_node_for_traversal

        # --- Validation logic for the FINAL node ---
        if not final_node:
            if allow_missing:
                # We already checked 'execute' on the parent, now check 'write'
                if not self._check_permission(current_node_for_traversal, user_context, 'write'):
                    return {"success": False, "error": f"Permission denied to create in '{current_path_for_traversal}'"}
                return {"success": True, "node": None, "resolvedPath": abs_path}
            return {"success": False, "error": "No such file or directory"}

        if expected_type and final_node.get('type') != expected_type:
            # Special case for directories, e.g., 'cd /path/to/file'
            if expected_type == 'directory' and final_node.get('type') == 'file':
                return {"success": False, "error": "Not a directory"}
            return {"success": False, "error": f"Is not a {expected_type}"}

        # Check the final set of permissions on the target node itself
        for perm in permissions_to_check:
            if not self._check_permission(final_node, user_context, perm):
                return {"success": False, "error": "Permission denied"}

        return {"success": True, "node": final_node, "resolvedPath": abs_path}


fs_manager = FileSystemManager()