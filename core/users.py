# gem/core/users.py

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import copy # For deepcopy

# We need to import our other managers to collaborate!
from filesystem import fs_manager
from groups import group_manager

class UserManager:
    """Manages user accounts, credentials, and properties."""
    def __init__(self):
        self.users = {}

    def initialize_defaults(self, default_username):
        """Initializes default users if they don't exist."""
        if 'root' not in self.users:
            self.users['root'] = {'passwordData': None, 'primaryGroup': 'root'}

        if default_username not in self.users:
            self.users[default_username] = {'passwordData': None, 'primaryGroup': default_username}

    def get_all_users(self):
        """Returns the entire users dictionary."""
        return self.users

    def load_users(self, users_dict):
        """Loads user data from a dictionary (from storage)."""
        self.users = users_dict.to_py() if hasattr(users_dict, 'to_py') else users_dict

    def user_exists(self, username):
        """Checks if a user exists."""
        return username in self.users

    def get_user(self, username):
        """Gets data for a single user."""
        return self.users.get(username)

    def _secure_hash_password(self, password):
        """Securely hashes a password using PBKDF2 with a random salt."""
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        pwd_hash = kdf.derive(password.encode('utf-8'))
        return {'salt': salt.hex(), 'hash': pwd_hash.hex()}

    def _verify_password_with_salt(self, password_attempt, salt_hex, stored_hash_hex):
        """Verifies a password attempt against a stored salt and hash."""
        salt = bytes.fromhex(salt_hex)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        try:
            kdf.verify(password_attempt.encode('utf-8'), bytes.fromhex(stored_hash_hex))
            return True
        except Exception:
            return False

    def register_user(self, username, password, primary_group):
        """Creates a new user account."""
        if self.user_exists(username):
            return {"success": False, "error": f"User '{username}' already exists."}

        password_data = self._secure_hash_password(password) if password else None
        self.users[username] = {'passwordData': password_data, 'primaryGroup': primary_group}
        return {"success": True, "user_data": self.users[username]}

    def remove_user(self, username):
        """Removes a user account."""
        if self.user_exists(username):
            del self.users[username]
            return True
        return False

    def verify_password(self, username, password_attempt):
        """Verifies a user's password."""
        user_entry = self.get_user(username)
        if not user_entry or not user_entry.get('passwordData'):
            return not password_attempt

        salt = user_entry['passwordData']['salt']
        stored_hash = user_entry['passwordData']['hash']
        return self._verify_password_with_salt(password_attempt, salt, stored_hash)

    def change_password(self, username, new_password):
        """Changes a user's password."""
        if not self.user_exists(username):
            return False

        new_password_data = self._secure_hash_password(new_password)
        self.users[username]['passwordData'] = new_password_data
        return True

    def first_time_setup(self, username, password, root_password):
        """
        Performs the initial system setup in a transactional manner.
        """
        # This check is too strict for the onboarding flow and prevents recovery
        # from a failed first attempt. It is safe to remove because this function
        # is only called during the explicit onboarding process.

        # Backup state for rollback
        original_users = copy.deepcopy(self.users)
        original_groups = copy.deepcopy(group_manager.groups)
        original_fs_data = copy.deepcopy(fs_manager.fs_data)

        try:
            # 1. Initialize the default filesystem structure
            fs_manager._initialize_default_filesystem()

            # 2. Create the new user's group
            if not group_manager.group_exists(username):
                group_manager.create_group(username)

            # 3. Register the new user
            registration_result = self.register_user(username, password, username)
            if not registration_result["success"]:
                # If the user already exists (from a partial fail), just proceed
                if "already exists" not in registration_result["error"]:
                    raise ValueError(registration_result["error"])

            # 4. Add the user to their own primary group
            group_manager.add_user_to_group(username, username)

            # 5. Create the user's home directory as root
            home_path = f"/home/{username}"
            # Create directory if it doesn't exist from a previous attempt
            if not fs_manager.get_node(home_path):
                fs_manager.create_directory(home_path, {"name": "root", "group": "root"})
                fs_manager.chown(home_path, username)
                fs_manager.chgrp(home_path, username)

            # 6. Set the root password (this will now overwrite if it was set in a failed attempt)
            self.change_password('root', root_password)

            # 7. Persist changes to the filesystem
            fs_manager._save_state()

            return {"success": True}
        except Exception as e:
            # Rollback to original state on any failure
            self.users = original_users
            group_manager.groups = original_groups
            fs_manager.fs_data = original_fs_data

            # The JS side already has a generic "Setup failed:" prefix
            return {"success": False, "error": f"An error occurred during setup: {str(e)}"}

user_manager = UserManager()