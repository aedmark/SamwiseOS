# gem/core/commands/printf.py

def _unescape(s):
    try:
        return bytes(s, "utf-8").decode("unicode_escape")
    except Exception:
        return s

def run(args, flags, user_context, stdin_data=None):
    """Format and print data."""
    if not args:
        return ""
    fmt = args[0]
    values = [_unescape(arg) for arg in args[1:]]

    if fmt == "%b" and values:
        return values[0]

    fmt_unescaped = _unescape(fmt).replace("%b", "%s")

    try:
        return fmt_unescaped % tuple(values)
    except TypeError:
        return " ".join([fmt_unescaped] + values)

def man(args, flags, user_context, stdin_data=None):
    """Displays the manual page for the printf command."""
    return '''
NAME
    printf - format and print data

SYNOPSIS
    printf FORMAT [ARGUMENT]...

DESCRIPTION
    Write formatted data to standard output. Interprets backslash escapes
    and format specifiers.

OPTIONS
    This command takes no options.

EXAMPLES
    printf "Hello, %s\\n" "World"
    printf "%b" "This string has \\t a tab."
'''

def help(args, flags, user_context, stdin_data=None):
    return "Usage: printf FORMAT [ARGUMENT]..."