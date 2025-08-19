# gem/core/commands/visudo.py

def define_flags():
    """Declares the flags that the visudo command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context):
    if args:
        return {"success": False, "error": "visudo: command takes no arguments."}

    return {
        "effect": "visudo"
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    visudo - edit the sudoers file

SYNOPSIS
    visudo

DESCRIPTION
    visudo edits the sudoers file in a safe way. It launches the system
    editor and, upon saving, will perform a syntax check before applying
    the changes. This is the only recommended way to edit the sudoers file.
    This command can only be run by the root user.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the visudo command."""
    return "Usage: visudo"