# gem/core/commands/pwd.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    """
    Returns the current working directory.
    """
    return fs_manager.current_path

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the pwd command.
    """
    return """
NAME
    pwd - print name of current/working directory

SYNOPSIS
    pwd

DESCRIPTION
    Print the full filename of the current working directory.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the pwd command.
    """
    return "Usage: pwd"