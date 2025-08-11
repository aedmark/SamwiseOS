# gem/core/commands/head.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the head command accepts."""
    return [
        {'name': 'lines', 'short': 'n', 'long': 'lines', 'takes_value': True},
        {'name': 'bytes', 'short': 'c', 'long': 'bytes', 'takes_value': True},
    ]

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

    line_count_str = flags.get('lines')
    byte_count_str = flags.get('bytes')

    if byte_count_str is not None:
        try:
            byte_count = int(byte_count_str)
            if byte_count < 0: raise ValueError
            full_content = "\n".join(lines)
            return full_content[:byte_count]
        except (ValueError, TypeError):
            return f"head: invalid number of bytes: '{byte_count_str}'"
    else:
        line_count = 10
        if line_count_str is not None:
            try:
                line_count = int(line_count_str)
                if line_count < 0: raise ValueError
            except (ValueError, TypeError):
                return f"head: invalid number of lines: '{line_count_str}'"
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