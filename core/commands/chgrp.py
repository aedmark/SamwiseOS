# gem/core/commands/chgrp.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the chgrp command accepts."""
    return [
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 2:
        return "chgrp: missing operand. Usage: chgrp [-R] <group> <path>..."

    if user_context.get('name') != 'root':
        # In a real system, the owner could also chgrp, but only to a group they are a member of.
        # For simplicity in OopisOS, we'll restrict it to root for now.
        return "chgrp: you must be root to change group ownership."

    new_group = args[0]
    paths = args[1:]
    is_recursive = flags.get('recursive', False)

    if groups is None or new_group not in groups:
        return f"chgrp: invalid group: '{new_group}'"

    for path in paths:
        try:
            fs_manager.chgrp(path, new_group, recursive=is_recursive)
        except FileNotFoundError:
            return f"chgrp: cannot access '{path}': No such file or directory"
        except Exception as e:
            return f"chgrp: an unexpected error occurred on '{path}': {repr(e)}"

    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    chgrp - change group ownership

SYNOPSIS
    chgrp [OPTION]... GROUP FILE...

DESCRIPTION
    Changes the group ownership of each given FILE to GROUP.
    
    -R, -r, --recursive
          operate on files and directories recursively
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: chgrp [-R] <group> <path>..."