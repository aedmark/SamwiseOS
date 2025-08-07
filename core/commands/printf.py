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
    # handle %b separately to mimic shell behavior
    if fmt == "%b" and values:
        return values[0]
    fmt_unescaped = _unescape(fmt).replace("%b", "%s")
    try:
        return fmt_unescaped % tuple(values)
    except Exception:
        return " ".join([fmt_unescaped] + values)


def man(args, flags, user_context, stdin_data=None):
    """Displays the manual page for the printf command."""
    return """NAME
    printf - format and print data

SYNOPSIS
    printf FORMAT [ARGUMENT]...

DESCRIPTION
    Write formatted data to standard output.
"""


def help(args, flags, user_context, stdin_data=None):
    """Provides help information for the printf command."""
    return "Usage: printf FORMAT [ARGUMENT]..."
