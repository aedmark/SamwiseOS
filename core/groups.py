# gem/core/groups.py

class GroupManager:
    """Manages user groups and their memberships."""
    def __init__(self):
        self.groups = {}

    def initialize_defaults(self):
        """Initializes the default groups if they don't exist."""
        if not self.groups:
            self.groups = {
                "root": {"members": ["root"]},
                "Guest": {"members": ["Guest"]},
                "userDiag": {"members": ["userDiag"]},
                "towncrier": {"members": []}
            }

    def get_all_groups(self):
        """Returns the entire groups dictionary."""
        return self.groups

    def load_groups(self, groups_dict):
        """Loads groups from a dictionary, typically from storage."""
        self.groups = groups_dict
        # Ensure default groups are present after loading
        if "root" not in self.groups:
            self.groups["root"] = {"members": ["root"]}
        if "Guest" not in self.groups:
            self.groups["Guest"] = {"members": ["Guest"]}

    def group_exists(self, group_name):
        """Checks if a group exists."""
        return group_name in self.groups

    def create_group(self, group_name):
        """Creates a new, empty group."""
        if self.group_exists(group_name):
            return False
        self.groups[group_name] = {"members": []}
        return True

    def delete_group(self, group_name):
        """Deletes a group."""
        if self.group_exists(group_name):
            del self.groups[group_name]
            return True
        return False

    def add_user_to_group(self, username, group_name):
        """Adds a user to a group if they are not already a member."""
        if self.group_exists(group_name) and username not in self.groups[group_name]["members"]:
            self.groups[group_name]["members"].append(username)
            return True
        return False

    def remove_user_from_all_groups(self, username):
        """Removes a user from all groups they are a member of."""
        changed = False
        for group_name in self.groups:
            if username in self.groups[group_name]["members"]:
                self.groups[group_name]["members"].remove(username)
                changed = True
        return changed

# Instantiate a singleton that will be exposed to JavaScript
group_manager = GroupManager()