# gem/core/commands/set.py

import shlex
from session import env_manager

def run(args, flags, user_context, stdin_data=None):
    if not args:
        all_vars = env_manager.get_all()
        # The .items() method on PyProxy is not standard, convert to dict first
        vars_dict = dict(all_vars.toJs())
        output = [f"{key}={value}" for key, value in sorted(vars_dict.items())]
        return "\n".join(output)

    arg_string = " ".join(args)
    if '=' in arg_string:
        try:
            name, value = arg_string.split('=', 1)
            # Handle quoted values
            value_parts = shlex.split(value)
            value = value_parts[0] if value_parts else ""

            if not name.isidentifier():
                return f"set: invalid variable name: '{name}'"

            env_manager.set(name, value)
            return "" # Success
        except ValueError:
            return f"set: invalid format: {arg_string}"
    else:
        # `set var` is not standard, but shells often set it to empty. We'll do that too.
        name = arg_string
        if not name.isidentifier():
            return f"set: invalid variable name: '{name}'"
        env_manager.set(name, "")
        return ""


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