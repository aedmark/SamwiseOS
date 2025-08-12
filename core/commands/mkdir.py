# gem/core/commands/mkdir.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the mkdir command accepts."""
    return [
        {'name': 'parents', 'short': 'p', 'long': 'parents', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    """
    Creates new directories.
    """
    if not args:
        return {"success": False, "error": "mkdir: missing operand"}

    is_parents = flags.get('parents', False)

    for path in args:
        try:
            fs_manager.create_directory(path, user_context)
        except FileExistsError:
            if not is_parents:
                return {"success": False, "error": f"mkdir: cannot create directory ‘{path}’: File exists"}
        except FileNotFoundError as e:
            return {"success": False, "error": f"mkdir: cannot create directory ‘{path}’: {e}"}
        except Exception as e:
            return {"success": False, "error": f"mkdir: an unexpected error occurred with '{path}': {repr(e)}"}

    return "" # Success

def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    """
    Provides help information for the mkdir command.
    """
    return "Usage: mkdir [-p] [DIRECTORY]..."