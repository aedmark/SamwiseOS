# gem/core/commands/mkdir.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    """
    Creates new directories.
    """
    if not args:
        return help(args, flags, user_context)

    for path in args:
        try:
            # Use the robust create_directory function from our filesystem core
            fs_manager.create_directory(path, user_context)
        except FileExistsError:
            return f"mkdir: cannot create directory ‘{path}’: File exists"
        except FileNotFoundError:
            return f"mkdir: cannot create directory ‘{path}’: No such file or directory"
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
    mkdir [DIRECTORY]...

DESCRIPTION
    Create the DIRECTORY(ies), if they do not already exist.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the mkdir command.
    """
    return "Usage: mkdir [DIRECTORY]..."