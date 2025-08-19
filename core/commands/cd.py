# gem/core/commands/cd.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Validates a directory path and returns an effect to change the current directory.
    """
    if not args:
        # cd with no arguments typically goes to the user's home directory
        path_arg = f"/home/{user_context.get('name', 'guest')}"
    elif len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "cd: too many arguments",
                "suggestion": "The 'cd' command only accepts a single directory path."
            }
        }
    else:
        path_arg = args[0]

    # Use the robust validation from our filesystem manager
    validation_result = fs_manager.validate_path(path_arg, user_context, '{"expectedType": "directory", "permissions": ["execute"]}')

    if not validation_result.get("success"):
        # Wrap the detailed error from the filesystem manager in our new format
        return {
            "success": False,
            "error": {
                "message": f"cd: {path_arg}: {validation_result.get('error')}",
                "suggestion": "Check that the directory exists and that you have permission to access it. Use 'ls -l' to check permissions."
            }
        }

    # If validation passes, send an effect to the JS side to update the state.
    return {
        "effect": "change_directory",
        "path": validation_result.get("resolvedPath")
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    cd - change the current directory

SYNOPSIS
    cd [directory]

DESCRIPTION
    Changes the current working directory of the shell to the specified directory. If no directory is given, it defaults to the current user's home directory.

EXAMPLES
    cd /home/guest
    cd ..
    cd
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the cd command."""
    return "Usage: cd [directory]"