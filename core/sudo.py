# gem/core/sudo.py

class SudoManager:
    """Manages sudo privileges by parsing the sudoers file."""
    def __init__(self, fs_manager):
        self.fs_manager = fs_manager
        self.sudoers_config = None
        self.SUDOERS_PATH = "/etc/sudoers"

    def _parse_sudoers(self):
        """Parses the /etc/sudoers file and caches the configuration."""
        sudoers_node = self.fs_manager.get_node(self.SUDOERS_PATH)
        if not sudoers_node or sudoers_node.get('type') != 'file':
            self.sudoers_config = {'users': {}, 'groups': {}}
            return

        content = sudoers_node.get('content', '')
        lines = content.splitlines()
        config = {'users': {}, 'groups': {}}

        for line in lines:
            line = line.strip()
            if line.startswith('#') or not line:
                continue

            parts = line.split()
            if len(parts) < 2:
                continue

            entity = parts[0]
            # In a real sudoers, this part is much more complex (host, user, etc.)
            # We are simplifying to just the allowed commands list.
            permissions = parts[1:]

            # This is a very simplified model where we assume `ALL=(ALL) ALL` becomes just `ALL`
            allowed_commands = []
            all_found = False
            for part in permissions:
                if "ALL" in part:
                    all_found = True
                    break

            if all_found:
                allowed_commands = ["ALL"]
            else:
                # This part is tricky in a real sudoers file. We'll simplify.
                # A real implementation would parse the command list properly.
                # For now, we'll assume the last part is the command list.
                allowed_commands = permissions[-1].split(',')


            if entity.startswith('%'):
                config['groups'][entity[1:]] = allowed_commands
            else:
                config['users'][entity] = allowed_commands

        self.sudoers_config = config

    def _get_config(self):
        """Returns the sudoers config, parsing if necessary."""
        if self.sudoers_config is None:
            self._parse_sudoers()
        return self.sudoers_config

    def can_user_run_command(self, username, user_groups, command_to_run):
        """Checks if a user has permission to run a specific command via sudo."""
        if username == 'root':
            return True

        config = self._get_config()

        # Check user-specific rules first
        user_perms = config['users'].get(username)
        if user_perms:
            if "ALL" in user_perms or command_to_run in user_perms:
                return True

        # Check group rules
        for group in user_groups:
            group_perms = config['groups'].get(group)
            if group_perms:
                if "ALL" in group_perms or command_to_run in group_perms:
                    return True

        return False

# This manager will be instantiated in the kernel, passing the fs_manager