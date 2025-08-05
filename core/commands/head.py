# gem/core/commands/head.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    lines = []

    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"head: {path}: No such file or directory"
            if node.get('type') != 'file':
                return f"head: error reading '{path}': Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        return "" # No input, no output

    line_count = 10
    if "-n" in flags:
        try:
            line_count = int(flags["-n"])
            if line_count < 0:
                raise ValueError
        except (ValueError, TypeError):
            # The JS side handles parsing, but we check again for safety
            return f"head: invalid number of lines: '{flags['-n']}'"

    byte_count = None
    if "-c" in flags:
        try:
            byte_count = int(flags["-c"])
            if byte_count < 0:
                raise ValueError
        except (ValueError, TypeError):
            return f"head: invalid number of bytes: '{flags['-c']}'"

    if byte_count is not None:
        full_content = "\n".join(lines)
        return full_content[:byte_count]
    else:
        return "\n".join(lines[:line_count])

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    head - output the first part of files

SYNOPSIS
    head [OPTION]... [FILE]...

DESCRIPTION
    Print the first 10 lines of each FILE to standard output.
    With no FILE, or when FILE is -, read standard input.

    -n, --lines=COUNT
          print the first COUNT lines instead of the first 10
    -c, --bytes=COUNT
          print the first COUNT bytes
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: head [-n lines | -c bytes] [FILE]..."