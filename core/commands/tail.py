# gem/core/commands/tail.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the tail command accepts."""
    return [
        {'name': 'lines', 'short': 'n', 'long': 'lines', 'takes_value': True},
        {'name': 'bytes', 'short': 'c', 'long': 'bytes', 'takes_value': True},
        {'name': 'follow', 'short': 'f', 'long': 'follow', 'takes_value': False},
    ]

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
    # Logic to handle both piped data and file arguments
    if stdin_data:
        content = stdin_data
    elif args:
        # If there are flags, the file is the last argument. This is a simple way to handle it.
        # A more robust parser would be better, but this matches the script's usage.
        file_path = args[-1]
        node = fs_manager.get_node(file_path)
        if not node:
            # Check if an argument that looks like a flag was misinterpreted as a file
            for arg in args:
                if arg.startswith('-'):
                    return {
                        "success": False,
                        "error": {
                            "message": f"tail: invalid option -- '{arg.lstrip('-')}'",
                            "suggestion": "Ensure flags are placed before the filename."
                        }
                    }
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
            # Slicing from the end for bytes
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

    -n, --lines=COUNT
          output the last COUNT lines, instead of the last 10
    -c, --bytes=COUNT
          output the last COUNT bytes
    -f, --follow
          output appended data as the file grows
          (NOTE: This feature is handled by the JS command layer)
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the tail command."""
    return "Usage: tail [-n COUNT] [-c BYTES] [-f] [FILE]..."