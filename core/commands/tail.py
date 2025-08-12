# gem/core/commands/tail.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the tail command accepts."""
    return [
        {'name': 'lines', 'short': 'n', 'long': 'lines', 'takes_value': True},
        {'name': 'follow', 'short': 'f', 'long': 'follow', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if flags.get('follow', False):
        return {"success": False, "error": "tail: -f is handled by the JavaScript layer and should not reach the Python kernel."}

    lines = []
    line_count = 10

    if flags.get('lines'):
        try:
            line_count = int(flags['lines'])
            if line_count < 0:
                line_count = 10
        except (ValueError, TypeError):
            return {"success": False, "error": f"tail: invalid number of lines: '{flags['lines']}'"}

    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return {"success": False, "error": f"tail: cannot open '{path}' for reading: No such file or directory"}
            if node.get('type') != 'file':
                return {"success": False, "error": f"tail: error reading '{path}': Is a directory"}
            lines.extend(node.get('content', '').splitlines())
    else:
        return ""

    return "\\n".join(lines[-line_count:])

def man(args, flags, user_context, **kwargs):
    return """
NAME
    tail - output the last part of files

SYNOPSIS
    tail [OPTION]... [FILE]...

DESCRIPTION
    Print the last 10 lines of each FILE to standard output.
    With no FILE, or when FILE is -, read standard input.

    -n, --lines=COUNT
          output the last COUNT lines, instead of the last 10
    -f, --follow
          output appended data as the file grows
          (NOTE: This feature is handled by the JS command layer)
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the tail command."""
    return "Usage: tail [-n COUNT] [-f] [FILE]..."