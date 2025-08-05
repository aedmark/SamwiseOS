# gem/core/commands/help.py

def run(args, flags, user_context, stdin_data=None):
    """
    Displays a list of available commands.
    """
    # This list should be updated as we add more Python commands
    available_commands = [
        "cat", "clear", "date", "echo", "help", "ls", "man",
        "mkdir", "mv", "pwd", "rm", "touch", "whoami"
    ]

    output = [
        "SamwiseOS - Powered by Python",
        "Welcome to the official command reference.",
        "The following commands are available:",
        "",
        "  " + "  ".join(available_commands),
        "",
        "Use 'man [command]' for more information on a specific command."
    ]
    return "\n".join(output)

def man(args, flags, user_context, stdin_data=None):
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

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the help command.
    """
    return "Usage: help"