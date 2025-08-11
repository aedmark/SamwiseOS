# gem/core/commands/cat.py
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the cat command accepts."""
    return [
        {'name': 'number', 'short': 'n', 'long': 'number', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Concatenates files and prints them to the standard output.
    Supports reading from stdin and line numbering.
    """
    output_parts = []
    files = args

    # We must first check if stdin_data has a value. A simple 'if stdin_data:'
    # is the most Pythonic way to handle this. It will correctly evaluate
    # None, empty strings, and the JavaScript 'null' (JsNull) as False,
    # preventing the AttributeError.
    if stdin_data:
        output_parts.extend(stdin_data.splitlines())

    if not files and not output_parts:
        # If no files were provided and there was no stdin, cat should
        # simply exit without error.
        return ""

    for file_path in files:
        try:
            content = fs_manager.read_file(file_path)
            if content is not None:
                output_parts.extend(content.splitlines())
            else:
                # This case is unlikely if read_file raises an error, but it's good practice.
                output_parts.append(f"cat: {file_path}: No such file or directory")
        except FileNotFoundError:
            output_parts.append(f"cat: {file_path}: No such file or directory")
        except IsADirectoryError:
            output_parts.append(f"cat: {file_path}: Is a directory")

    if flags.get('number'):
        numbered_output = []
        # Start numbering from 1.
        for i, line in enumerate(output_parts, 1):
            # The format requires a specific padding.
            numbered_output.append(f"     {i}  {line}")
        return "\n".join(numbered_output)
    else:
        return "\n".join(output_parts)

def man(args, flags, user_context, **kwargs):
    """Displays the manual page for the cat command."""
    return """
NAME
    cat - concatenate files and print on the standard output

SYNOPSIS
    cat [-n] [FILE]...

DESCRIPTION
    Concatenate FILE(s) to standard output.

    With no FILE, or when FILE is -, read standard input.

    -n, --number    number all output lines
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the cat command."""
    return "Usage: cat [-n] [FILE]..."