# gem/core/commands/echo.py

import codecs

def define_flags():
    """Declares the flags that the echo command accepts."""
    return {
        'flags': [
            {'name': 'enable-backslash-escapes', 'short': 'e', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None):
    """
    Displays a line of text, with an option to interpret backslash escapes.
    """
    enable_escapes = flags.get('enable-backslash-escapes', False)
    output_string = " ".join(args)

    if enable_escapes:
        # Using codecs.decode with 'unicode_escape' is a robust way to handle this
        output_string = codecs.decode(output_string, 'unicode_escape')

    return output_string

def man(args, flags, user_context, **kwargs):
    """
    Displays the manual page for the echo command.
    """
    return """
NAME
    echo - display a line of text

SYNOPSIS
    echo [-e] [STRING]...

DESCRIPTION
    Echo the STRING(s) to standard output, followed by a newline.

OPTIONS
    -e
        Enable interpretation of backslash escapes (e.g., \\n for newline, \\t for tab).

EXAMPLES
    echo "Hello, world!"
    echo -e "First line\\nSecond line"
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: echo [-e] [STRING]..."