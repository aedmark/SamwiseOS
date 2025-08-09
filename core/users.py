# gem/core/users.py

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

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

user_manager = UserManager()