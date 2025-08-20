# gem/core/commands/tail.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the tail command accepts."""
    return {
        'flags': [
            {'name': 'lines', 'short': 'n', 'long': 'lines', 'takes_value': True},
            {'name': 'bytes', 'short': 'c', 'long': 'bytes', 'takes_value': True},
            {'name': 'follow', 'short': 'f', 'long': 'follow', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if flags.get('follow', False):
        return {
            "success": False,
            "error": {
                "message": "tail: -f is handled by the JavaScript layer and should not reach the Python kernel.",
                "suggestion": "The '-f' flag is a special case. It works as intended, this is an internal message."
            }
        }

    content = ""
    if stdin_data:
        content = stdin_data
    elif args:
        file_path = args[-1]
        node = fs_manager.get_node(file_path)
        if not node:
            return {
                "success": False,
                "error": {
                    "message": f"tail: cannot open '{file_path}' for reading: No such file or directory",
                    "suggestion": "Please check the file path is correct."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"tail: error reading '{file_path}': Is a directory",
                    "suggestion": "The tail command can only process files."
                }
            }
        content = node.get('content', '')
    else:
        return "" # No input, no output

    line_count_str = flags.get('lines')
    byte_count_str = flags.get('bytes')

    if byte_count_str is not None:
        try:
            byte_count = int(byte_count_str)
            if byte_count < 0: raise ValueError
            return content[-byte_count:]
        except (ValueError, TypeError):
            return {
                "success": False,
                "error": {
                    "message": f"tail: invalid number of bytes: '{byte_count_str}'",
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
                        "message": f"tail: invalid number of lines: '{line_count_str}'",
                        "suggestion": "Please provide a non-negative integer for the line count."
                    }
                }

        lines = content.splitlines()
        return "\n".join(lines[-line_count:])


def man(args, flags, user_context, **kwargs):
    return """
NAME
    tail - output the last part of files

SYNOPSIS
    tail [OPTION]... [FILE]...

DESCRIPTION
    Print the last 10 lines of each FILE to standard output.
    With no FILE, or when FILE is -, read standard input.

OPTIONS
    -n, --lines=COUNT
          Output the last COUNT lines, instead of the last 10.
    -c, --bytes=COUNT
          Output the last COUNT bytes.
    -f, --follow
          Output appended data as the file grows.

EXAMPLES
    tail /var/log/system.log
    tail -n 20 my_notes.txt
    ls -l | tail -n 5
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: tail [OPTION]... [FILE]..."