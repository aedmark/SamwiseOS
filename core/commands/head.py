# gem/core/commands/head.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the head command accepts."""
    return {
        'flags': [
            {'name': 'lines', 'short': 'n', 'long': 'lines', 'takes_value': True},
            {'name': 'bytes', 'short': 'c', 'long': 'bytes', 'takes_value': True},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None):
    lines = []
    has_errors = False
    error_output = []

    if stdin_data:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                error_output.append(f"head: {path}: No such file or directory")
                has_errors = True
                continue
            if node.get('type') != 'file':
                error_output.append(f"head: error reading '{path}': Is a directory")
                has_errors = True
                continue
            lines.extend(node.get('content', '').splitlines())
    else:
        return ""

    if has_errors and not lines:
        return {
            "success": False,
            "error": {
                "message": "\n".join(error_output),
                "suggestion": "Check the file paths and try again."
            }
        }


    line_count_str = flags.get('lines')
    byte_count_str = flags.get('bytes')

    if byte_count_str is not None:
        try:
            byte_count = int(byte_count_str)
            if byte_count < 0: raise ValueError
            full_content = "\n".join(lines)
            return full_content[:byte_count]
        except (ValueError, TypeError):
            return {
                "success": False,
                "error": {
                    "message": f"head: invalid number of bytes: '{byte_count_str}'",
                    "suggestion": "Please provide a non-negative integer for the byte count."
                }
            }
    else:
        line_count = 10
        if line_count_str is not None:
            try:
                line_count = int(line_count_str)
                if line_count < 0: raise ValueError
            except (ValueError, TypeError):
                return {
                    "success": False,
                    "error": {
                        "message": f"head: invalid number of lines: '{line_count_str}'",
                        "suggestion": "Please provide a non-negative integer for the line count."
                    }
                }
        return "\n".join(lines[:line_count])


def man(args, flags, user_context, **kwargs):
    return """
NAME
    head - output the first part of files

SYNOPSIS
    head [OPTION]... [FILE]...

DESCRIPTION
    Print the first 10 lines of each FILE to standard output. With no FILE, or when FILE is -, read standard input.

OPTIONS
    -n, --lines=COUNT
        Print the first COUNT lines instead of the first 10.
    -c, --bytes=COUNT
        Print the first COUNT bytes.

EXAMPLES
    head /var/log/system.log
    head -n 5 my_file.txt
    ls | head -n 3
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: head [-n COUNT] [-c BYTES] [FILE]..."