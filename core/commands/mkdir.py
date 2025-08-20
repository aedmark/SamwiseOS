# gem/core/commands/mkdir.py

from filesystem import fs_manager

def define_flags():
    return {
        'flags': [
            {'name': 'parents', 'short': 'p', 'long': 'parents', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": {"message": "mkdir: missing operand", "suggestion": "Try 'mkdir <directory_name>'."}}

    is_parents = flags.get('parents', False)

    for path in args:
        try:
            fs_manager.create_directory(path, user_context, parents=is_parents)
        except FileExistsError as e:
            if not is_parents:
                return {
                    "success": False,
                    "error": {
                        "message": f"mkdir: cannot create directory ‘{path}’: {e}",
                        "suggestion": "If you meant to create parent directories, try using the '-p' flag."
                    }
                }
        except PermissionError as e:
            return {
                "success": False,
                "error": {
                    "message": f"mkdir: cannot create directory ‘{path}’: {e}",
                    "suggestion": "Check your permissions for the parent directory."
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

    return ""

def man(args, flags, user_context, **kwargs):
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
    return "Usage: mkdir [-p] [DIRECTORY]..."