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
        return {"success": False, "error": {"message": "mkdir: missing operand", "suggestion": "Try 'mkdir <directory_name>'."}}

    is_parents = flags.get('parents', False)

    for path in args:
        try:
            fs_manager.create_directory(path, user_context)
        except FileExistsError:
            if not is_parents:
                return {
                    "success": False,
                    "error": {
                        "message": f"mkdir: cannot create directory ‘{path}’: File exists.",
                        "suggestion": "If you meant to create parent directories, try using the '-p' flag."
                    }
                }
        except FileNotFoundError as e:
            return {
                "success": False,
                "error": {
                    "message": f"mkdir: cannot create directory ‘{path}’: {e}",
                    "suggestion": "Ensure the parent directory exists or use the '-p' flag."
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "message": f"mkdir: an unexpected error occurred with '{path}': {repr(e)}",
                    "suggestion": "Please check the path and your permissions."
                }
            }

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