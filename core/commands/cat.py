# gem/core/commands/cat.py
from filesystem import fs_manager
import json

def define_flags():
    """Declares the flags that the cat command accepts."""
    return {
        'flags': [
            {'name': 'number', 'short': 'n', 'long': 'number', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None):
    """
    Concatenates files and prints them to the standard output, with permission checks.
    """
    output_parts = []
    files = args if args else []
    error_messages = []

    # If there's data from a pipe, process it first.
    if stdin_data is not None:
        output_parts.extend(stdin_data.splitlines())

    # Process each file argument.
    for file_path in files:
        node = fs_manager.get_node(file_path)

        if not node:
            error_messages.append(f"cat: {file_path}: No such file or directory")
            continue

        if not fs_manager.has_permission(file_path, user_context, 'read'):
            error_messages.append(f"cat: {file_path}: Permission denied")
            continue

        if node.get('type') != 'file':
            error_messages.append(f"cat: {file_path}: Is a directory")
            continue

        try:
            content = node.get('content', '')
            output_parts.extend(content.splitlines())
        except Exception as e:
            error_messages.append(f"cat: {file_path}: An unexpected error occurred - {repr(e)}")

    # If there were any errors at all, return a structured error.
    # This is more consistent than mixing output and errors.
    if error_messages:
        return {
            "success": False,
            "error": {
                "message": "\n".join(error_messages),
                "suggestion": "Verify the file paths and ensure you have read permissions."
            }
        }

    # Handle the case of `cat` with no arguments and no stdin.
    if not files and stdin_data is None:
        return ""

    # Format the final output if there were no errors.
    if flags.get('number'):
        numbered_output = []
        for i, line in enumerate(output_parts):
            numbered_output.append(f"     {i + 1}  {line}")
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
    The cat utility reads files sequentially, writing them to the standard output. The FILE operands are processed in command-line order. If FILE is a single dash ('-') or absent, cat reads from the standard input.

OPTIONS
    -n, --number
          Number all output lines, starting with 1.

EXAMPLES
    cat file1.txt
        Display the content of file1.txt.

    cat file1.txt file2.txt > newfile.txt
        Concatenate two files and write the output to a new file.

    ls | cat -n
        Number the lines of the output from the ls command.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the cat command."""
    return "Usage: cat [-n] [FILE]..."