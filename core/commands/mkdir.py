# gem/core/commands/mkdir.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the mkdir command accepts."""
    return [
        {'name': 'parents', 'short': 'p', 'long': 'parents', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Creates new directories.
    """
    if not args:
        return help(args, flags, user_context)

    is_parents = flags.get('parents', False)

    for path in args:
        try:
            # The create_directory function already supports parent creation
            fs_manager.create_directory(path, user_context)
        except FileExistsError:
            # Only return an error if the directory exists AND '-p' was not used.
            if not is_parents:
                return f"mkdir: cannot create directory ‘{path}’: File exists"
        except FileNotFoundError as e:
            return f"mkdir: cannot create directory ‘{path}’: {e}"
        except Exception as e:
            return f"mkdir: an unexpected error occurred with '{path}': {repr(e)}"

    return "" # Success

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the mkdir command.
    """
    return """
NAME
    mkdir - make directories

SYNOPSIS
    mkdir [-p] [DIRECTORY]...

DESCRIPTION
    Create the DIRECTORY(ies), if they do not already exist.

    -p, --parents
          no error if existing, make parent directories as needed
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the mkdir command.
    """
    return "Usage: mkdir [-p] [DIRECTORY]..."