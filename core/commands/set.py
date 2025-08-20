# gem/core/commands/set.py

import shlex
from session import env_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        all_vars = env_manager.get_all()
        output = [f"{key}={value}" for key, value in sorted(all_vars.items())]
        return "\n".join(output)

    arg_string = " ".join(args)
    if '=' in arg_string:
        try:
            name, value = arg_string.split('=', 1)
            # This is the new, correct logic for handling quotes
            if (value.startswith('"') and value.endswith('"')) or \
                    (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]

            if not name.isidentifier():
                return {
                    "success": False,
                    "error": {
                        "message": f"set: invalid variable name: '{name}'",
                        "suggestion": "Variable names must start with a letter or underscore and contain only letters, numbers, or underscores."
                    }
                }

            env_manager.set(name, value)
            return {
                "success": True,
                "output": "",
                "effect": "sync_session_state",
                "env": env_manager.get_all()
            }
        except ValueError:
            return {
                "success": False,
                "error": {
                    "message": f"set: invalid format: {arg_string}",
                    "suggestion": "Use the format 'set VARIABLE=\"value\"'."
                }
            }
    else:
        name = arg_string
        if not name.isidentifier():
            return {
                "success": False,
                "error": {
                    "message": f"set: invalid variable name: '{name}'",
                    "suggestion": "Variable names must start with a letter or underscore and contain only letters, numbers, or underscores."
                }
            }
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
    Set or display environment variables. When run without arguments, it displays
    a list of all current environment variables. When a variable and value
    are provided, it sets or updates the variable.

OPTIONS
    This command takes no options.

EXAMPLES
    set
    set MY_VAR="hello world"
    set PROMPT_STYLE="simple"
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: set [variable[=value]]"