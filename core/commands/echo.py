# gem/core/commands/echo.py

def run(args, flags, user_context, stdin_data=None):
    """
    Displays a line of text.
    """
    return " ".join(args)

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the echo command.
    """
    return """
NAME
    echo - display a line of text

SYNOPSIS
    echo [STRING]...

DESCRIPTION
    Echo the STRING(s) to standard output.
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the echo command.
    """
    return "Usage: echo [STRING]..."