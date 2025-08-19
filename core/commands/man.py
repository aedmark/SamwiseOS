# gem/core/commands/man.py
from importlib import import_module

def run(args, flags, user_context, **kwargs):
    """
    Dynamically retrieves and displays the manual page for a given command.
    """
    if not args:
        return {
            "success": False,
            "error": {
                "message": "man: what manual page do you want?",
                "suggestion": "Try 'man ls' to see the manual for the 'ls' command."
            }
        }

    cmd_name = args[0]

    try:
        command_module = import_module(f"commands.{cmd_name}")
        man_func = getattr(command_module, 'man', None)

        if man_func and callable(man_func):
            return man_func(args, flags, user_context, **kwargs)
        else:
            return {
                "success": False,
                "error": {
                    "message": f"man: no manual entry for {cmd_name}",
                    "suggestion": "Not all commands have a manual page yet."
                }
            }
    except ImportError:
        return {
            "success": False,
            "error": {
                "message": f"man: command '{cmd_name}' not found",
                "suggestion": "Check the spelling of the command."
            }
        }

def man(args, flags, user_context, **kwargs):
    """Displays the manual page for the man command itself."""
    return """
NAME
    man - format and display the on-line manual pages

SYNOPSIS
    man [command_name]

DESCRIPTION
    man is the system's manual pager. It formats and displays the
    on-line manual page for a given command.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the man command."""
    return "Usage: man <command>"