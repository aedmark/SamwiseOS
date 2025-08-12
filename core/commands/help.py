# gem/core/commands/help.py

def run(args, flags, user_context, stdin_data=None, commands=None):
    """
    Displays a list of available commands, now dynamically.
    """
    # If the executor provides the list of all commands, we use it!
    if commands:
        available_commands = commands
    else:
        # Fallback to the old, sad, hardcoded list if something goes wrong.
        available_commands = [
            "cat", "clear", "date", "echo", "help", "ls", "man",
            "mkdir", "mv", "pwd", "rm", "touch", "whoami"
        ]

    output = [
        "SamwiseOS - Powered by Python",
        "Welcome to the official command reference.",
        "The following commands are available:",
        "",
        # We'll format it nicely in columns.
        _format_in_columns(available_commands),
        "",
        "Use 'man [command]' for more information on a specific command."
    ]
    return "\n".join(output)

def _format_in_columns(items, columns=4, width=80):
    """Helper function to format a list of strings into neat columns."""
    if not items:
        return ""
    col_width = (width // columns) - 2  # -2 for spacing
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
    help

DESCRIPTION
    help displays a list of common commands that are built into the
    SamwiseOS Python kernel. For more details on a specific command,
    type 'man [command_name]'.
"""

def help(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Provides help information for the help command.
    """
    return "Usage: help"