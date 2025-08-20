# /core/commands/pwd.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    if args:
        return {
            "success": False,
            "error": {
                "message": "pwd: command takes no arguments",
                "suggestion": "Simply run 'pwd' by itself."
            }
        }
    return fs_manager.current_path

def man(args, flags, user_context, **kwargs):
    return """
NAME
    pwd - print name of current/working directory

SYNOPSIS
    pwd

DESCRIPTION
    Print the full filename of the current working directory.

OPTIONS
    This command takes no options.

EXAMPLES
    pwd
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: pwd"