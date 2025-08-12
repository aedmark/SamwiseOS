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

    # If there's stdin data, we process it first.
    # This check is now more robust to handle inputs from the JS side!
    if stdin_data:
        output_parts.extend(stdin_data.splitlines())

    # If there are file arguments, process them.
    for file_path in files:
        try:
            node = fs_manager.get_node(file_path)
            if not node:
                # Unlike other commands, cat continues on error, so we append the error message.
                output_parts.append(f"cat: {file_path}: No such file or directory")
                continue
            if node.get('type') != 'file':
                output_parts.append(f"cat: {file_path}: Is a directory")
                continue

            content = node.get('content', '')
            output_parts.extend(content.splitlines())
        except Exception as e:
            output_parts.append(f"cat: {file_path}: An unexpected error occurred - {repr(e)}")

    # If there was no stdin and no file arguments, the output is empty.
    if not files and not stdin_data:
        return ""

    # Apply line numbering if the flag is set.
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