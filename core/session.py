# gem/core/session.py

import json

class EnvironmentManager:
    """Manages shell environment variables."""
    def __init__(self):
        self.env_stack = [{}]

    def initialize_defaults(self, user_context):
        """Initializes the default environment variables for a user."""
        username = user_context.get('name', 'Guest')
        self.env_stack = [{
            "USER": username,
            "HOME": f"/home/{username}",
            "HOST": "SamwiseOS",
            "PATH": "/bin:/usr/bin",
            "PS1": "\\u@\\h:\\w\\$ "
        }]

    def _get_active_env(self):
        return self.env_stack[-1]

    def push(self):
        self.env_stack.append(self._get_active_env().copy())

    def pop(self):
        if len(self.env_stack) > 1:
            self.env_stack.pop()

    def get(self, var_name):
        return self._get_active_env().get(var_name, "")

    def set(self, var_name, value):
        self._get_active_env()[var_name] = value
        return True

    def unset(self, var_name):
        if var_name in self._get_active_env():
            del self._get_active_env()[var_name]
        return True

    def get_all(self):
        return self._get_active_env()

    def load(self, vars_dict):
        native_dict = vars_dict.to_py() if hasattr(vars_dict, 'to_py') else vars_dict
        self.env_stack[-1] = native_dict.copy()

class HistoryManager:
    """Manages command history."""
    def __init__(self):
        self.command_history = []
        self.max_history_size = 50

    def add(self, command):
        trimmed = command.strip()
        if trimmed and (not self.command_history or self.command_history[-1] != trimmed):
            self.command_history.append(trimmed)
            if len(self.command_history) > self.max_history_size:
                self.command_history.pop(0)
        return True

    def get_full_history(self):
        return self.command_history

    def clear_history(self):
        self.command_history = []
        return True

    def set_history(self, new_history):
        self.command_history = list(new_history)
        if len(self.command_history) > self.max_history_size:
            self.command_history = self.command_history[-self.max_history_size:]
        return True

class AliasManager:
    """Manages command aliases."""
    def __init__(self):
        self.aliases = {}

    def initialize_defaults(self):
        """Initializes default command aliases."""
        self.aliases = {
            'll': 'ls -la',
            'la': 'ls -a',
            '..': 'cd ..',
            '...': 'cd ../..',
            'h': 'history',
            'c': 'clear',
            'q': 'exit',
            'e': 'edit',
            'ex': 'explore'
        }

    def set_alias(self, name, value):
        self.aliases[name] = value
        return True

    def remove_alias(self, name):
        if name in self.aliases:
            del self.aliases[name]
            return True
        return False

    def get_alias(self, name):
        return self.aliases.get(name)

    def get_all_aliases(self):
        return self.aliases

    def load_aliases(self, alias_dict):
        native_dict = alias_dict.to_py() if hasattr(alias_dict, 'to_py') else alias_dict
        self.aliases = native_dict.copy()

class SessionManager:
    """Manages the user session stack and orchestrates saving/loading session state."""
    def __init__(self):
        self.user_session_stack = ["Guest"]

    def get_stack(self):
        return self.user_session_stack

    def push(self, username):
        self.user_session_stack.append(username)
        return self.user_session_stack

    def pop(self):
        if len(self.user_session_stack) > 1:
            return self.user_session_stack.pop()
        return None

    def get_current_user(self):
        return self.user_session_stack[-1] if self.user_session_stack else "Guest"

    def clear(self, username):
        self.user_session_stack = [username]
        return self.user_session_stack

    def get_session_state_for_saving(self):
        """Gathers all session data into a single dictionary for saving."""
        return json.dumps({
            "commandHistory": history_manager.get_full_history(),
            "environmentVariables": env_manager.get_all(),
            "aliases": alias_manager.get_all_aliases()
        })

    def load_session_state(self, state_json):
        """
        Takes a JSON string of session state from the JS side
        and loads it into the appropriate Python managers.
        """
        try:
            state = json.loads(state_json)
            history_manager.set_history(state.get("commandHistory", []))
            env_manager.load(state.get("environmentVariables", {}))
            alias_manager.load_aliases(state.get("aliases", {}))
            return True
        except (json.JSONDecodeError, TypeError):
            history_manager.clear_history()
            env_manager.load({})
            alias_manager.load_aliases({})
            return False

# Instantiate singletons that will be exposed to JavaScript
env_manager = EnvironmentManager()
history_manager = HistoryManager()
alias_manager = AliasManager()
session_manager = SessionManager()