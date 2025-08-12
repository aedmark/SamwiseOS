# gem/core/commands/echo.py

import codecs

def define_flags():
    """Declares the flags that the echo command accepts."""
    return [
        {'name': 'enable-backslash-escapes', 'short': 'e', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Displays a line of text, with an option to interpret backslash escapes.
    """
    enable_escapes = flags.get('enable-backslash-escapes', False)
    output_string = " ".join(args)

    if enable_escapes:
        output_string = codecs.decode(output_string, 'unicode_escape')

    return output_string

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the echo command.
    """
    return """
NAME
    echo - display a line of text

SYNOPSIS
    echo [-e] [STRING]...

DESCRIPTION
    Echo the STRING(s) to standard output.

    -e    enable interpretation of backslash escapes
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the echo command.
    """
    return "Usage: echo [-e] [STRING]..."