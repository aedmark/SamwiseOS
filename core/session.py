# gem/core/session.py

import json

class EnvironmentManager:
    """Manages shell environment variables."""
    def __init__(self):
        self.env_stack = [{}]

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
        self.env_stack[-1] = vars_dict.copy()

class HistoryManager:
    """Manages command history."""
    def __init__(self):
        self.command_history = []
        self.max_history_size = 50 # Default, can be configured from JS

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
        # Apply truncation if needed
        if len(self.command_history) > self.max_history_size:
            self.command_history = self.command_history[-self.max_history_size:]
        return True

class AliasManager:
    """Manages command aliases."""
    def __init__(self):
        self.aliases = {}

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
        self.aliases = alias_dict.copy()

# Instantiate singletons that will be exposed to JavaScript
env_manager = EnvironmentManager()
history_manager = HistoryManager()
alias_manager = AliasManager()