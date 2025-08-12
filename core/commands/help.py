# gem/core/commands/help.py

from importlib import import_module

def run(args, flags, user_context, stdin_data=None, commands=None, **kwargs):
    """
    Displays help information for a specific command, or a list of all commands.
    """
    if args:
        cmd_name = args[0]
        try:
            command_module = import_module(f"commands.{cmd_name}")
            help_func = getattr(command_module, 'help', None)

            if help_func and callable(help_func):
                return help_func(args[1:], flags, user_context, **kwargs)
            else:
                return {"success": False, "error": f"help: no help entry for {cmd_name}"}

        except ImportError:
            return {"success": False, "error": f"help: command '{cmd_name}' not found"}

    # If no args, display the list of all available commands
    if commands:
        available_commands = commands
    else:
        # Fallback to a hardcoded list if the dynamic list isn't provided
        available_commands = [
            "cat", "clear", "date", "echo", "help", "ls", "man",
            "mkdir", "mv", "pwd", "rm", "touch", "whoami", "ERROR"
        ]

    output = [
        "SamwiseOS - Powered by Python",
        "Welcome to the official command reference.",
        "The following commands are available:",
        "",
        _format_in_columns(available_commands),
        "",
        "Use 'help [command]' for more information on a specific command."
    ]
    return "\n".join(output)

def _format_in_columns(items, columns=4, width=80):
    """Helper function to format a list of strings into neat columns."""
    if not items:
        return ""
    col_width = (width // columns) - 2
    formatted_lines = []
    for i in range(0, len(items), columns):
        line_items = [item.ljust(col_width) for item in items[i:i+columns]]
        formatted_lines.append("  ".join(line_items))
    return "\n".join(formatted_lines)


def man(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Displays the manual page for the help command.
    """
    return """
NAME
    help - display information about available commands

SYNOPSIS
    help [command]

DESCRIPTION
    help displays a list of all available commands. If a command is
    specified, it displays a short usage summary for that command. For
    more detailed information, use 'man [command]'.
"""

def help(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Provides help information for the help command.
    """
    return "Usage: help [command]"