# gem/core/commands/set.py

import shlex
from session import env_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        # The 'all_vars' object is already a Python dictionary
        all_vars = env_manager.get_all()
        output = [f"{key}={value}" for key, value in sorted(all_vars.items())]
        return "\n".join(output)

    arg_string = " ".join(args)
    if '=' in arg_string:
        try:
            name, value = arg_string.split('=', 1)
            # Handle quoted values
            if (value.startswith('"') and value.endswith('"')) or \
                    (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]

            if not name.isidentifier():
                return f"set: invalid variable name: '{name}'"

            env_manager.set(name, value)
            return {
                "success": True,
                "output": "",
                "effect": "sync_session_state",
                "env": env_manager.get_all()
            }
        except ValueError:
            return f"set: invalid format: {arg_string}"
    else:
        # `set var` is not standard, but shells often set it to empty. We'll do that too.
        name = arg_string
        if not name.isidentifier():
            return f"set: invalid variable name: '{name}'"
        env_manager.set(name, "")
        return {
            "success": True,
            "output": "",
            "effect": "sync_session_state",
            "env": env_manager.get_all()
        }


def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    set - set or display shell variables

SYNOPSIS
    set [variable[=value]]

DESCRIPTION
    Set or display environment variables.
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: set [variable[=value]]"