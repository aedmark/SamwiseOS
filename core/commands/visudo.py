# gem/core/commands/visudo.py

def define_flags():
    """Declares the flags that the visudo command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context, **kwargs):
    if args:
        return {
            "success": False,
            "error": {
                "message": "visudo: command takes no arguments",
                "suggestion": "Simply run 'visudo' by itself."
            }
        }


    # The actual editing and validation logic is handled by a special
    # effect on the JavaScript side. Python just needs to launch it.
    return {
        "effect": "launch_app",
        "app_name": "Editor",
        "options": {
            "filePath": "/etc/sudoers",
            "isVisudo": True # Special flag for the editor app
        }
    }


def man(args, flags, user_context, **kwargs):
    return """
NAME
    visudo - edit the sudoers file safely

SYNOPSIS
    visudo

DESCRIPTION
    visudo edits the sudoers file in a safe way. It launches the system
    editor and, upon saving, will perform a syntax check before applying

    the changes. This prevents configuration errors that could lock you
    out of root access. This is the only recommended way to edit the
    sudoers file. This command can only be run by the root user.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo visudo
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: visudo"