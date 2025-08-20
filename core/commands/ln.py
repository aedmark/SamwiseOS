# gem/core/commands/ln.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the ln command accepts."""
    return {
        'flags': [
            {'name': 'symbolic', 'short': 's', 'long': 'symbolic', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if not flags.get('symbolic'):
        return {
            "success": False,
            "error": {
                "message": "ln: only symbolic links (-s) are supported in this version.",
                "suggestion": "Try using the '-s' flag to create a symbolic link."
            }
        }

    if len(args) != 2:
        return {
            "success": False,
            "error": {
                "message": "ln: missing file operand.",
                "suggestion": "Try 'ln -s <target> <link_name>'."
            }
        }

    target, link_name = args[0], args[1]

    try:
        fs_manager.ln(target, link_name, user_context)
        return ""
    except FileExistsError as e:
        return {
            "success": False,
            "error": {
                "message": f"ln: failed to create symbolic link '{link_name}'",
                "suggestion": f"A file or directory already exists at that location. Details: {e}"
            }
        }
    except FileNotFoundError as e:
        return {
            "success": False,
            "error": {
                "message": f"ln: failed to create symbolic link '{link_name}'",
                "suggestion": f"The target directory does not exist. Details: {e}"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "ln: an unexpected error occurred.",
                "suggestion": f"Details: {repr(e)}"
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ln - make links between files

SYNOPSIS
    ln -s TARGET LINK_NAME

DESCRIPTION
    Create a symbolic link named LINK_NAME which points to TARGET. Hard links are not supported.

OPTIONS
    -s, --symbolic
        Make a symbolic link instead of a hard link. This is currently the only supported mode.

EXAMPLES
    ln -s /home/guest/file.txt /home/guest/link_to_file
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ln -s <target> <link_name>"