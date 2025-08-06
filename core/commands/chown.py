# gem/core/commands/chown.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    if len(args) < 2:
        return "chown: missing operand. Usage: chown [-R] <owner> <path>..."

    if user_context.get('name') != 'root':
        return "chown: you must be root to change ownership."

    new_owner = args[0]
    paths = args[1:]
    is_recursive = "-R" in flags or "-r" in flags or "--recursive" in flags

    if new_owner not in users:
        return f"chown: invalid user: '{new_owner}'"

    for path in paths:
        try:
            fs_manager.chown(path, new_owner, recursive=is_recursive)
        except FileNotFoundError:
            return f"chown: cannot access '{path}': No such file or directory"
        except Exception as e:
            return f"chown: an unexpected error occurred on '{path}': {repr(e)}"

    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return """
NAME
    chown - change file owner

SYNOPSIS
    chown [OPTION]... OWNER FILE...

DESCRIPTION
    Changes the user ownership of each given FILE to OWNER.
    
    -R, -r, --recursive
          operate on files and directories recursively
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return "Usage: chown [-R] <owner> <path>..."