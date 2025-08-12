# gem/core/commands/ln.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the ln command accepts."""
    return [
        {'name': 'symbolic', 'short': 's', 'long': 'symbolic', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    if not flags.get('symbolic'):
        return {"success": False, "error": "ln: only symbolic links (-s) are supported in this version."}

    if len(args) != 2:
        return {"success": False, "error": "ln: missing file operand. Usage: ln -s <target> <link_name>"}

    target, link_name = args[0], args[1]

    try:
        fs_manager.ln(target, link_name, user_context)
        return "" # Success
    except FileExistsError as e:
        return {"success": False, "error": f"ln: {e}"}
    except FileNotFoundError as e:
        return {"success": False, "error": f"ln: {e}"}
    except Exception as e:
        return {"success": False, "error": f"ln: an unexpected error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ln - make links between files

SYNOPSIS
    ln -s TARGET LINK_NAME

DESCRIPTION
    Create a symbolic link named LINK_NAME which points to TARGET.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the ln command."""
    return "Usage: ln -s <target> <link_name>"