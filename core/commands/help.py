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
                return {
                    "success": False,
                    "error": {
                        "message": f"help: no help entry for {cmd_name}",
                        "suggestion": "For more detailed information, try 'man {cmd_name}'."
                    }
                }
        except ImportError:
            return {
                "success": False,
                "error": {
                    "message": f"help: command '{cmd_name}' not found",
                    "suggestion": "Check the spelling or run 'help' to see all available commands."
                }
            }

    if not commands:
        commands = []

    output = [
        "SamwiseOS - Powered by Python",
        "Welcome to the official command reference.",
        "The following commands are available:",
        "",
        _format_in_columns(commands),
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


def man(args, flags, user_context, **kwargs):
    """
    Displays the manual page for the help command.
    """
    return """
NAME
    help - display information about available commands

SYNOPSIS
    help [command]

DESCRIPTION
    Displays a list of all available commands. If a command is specified, it displays a short usage summary for that command. For more detailed information, use 'man [command]'.

OPTIONS
    This command takes no options.

EXAMPLES
    help
    help ls
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: help [command]"