# gem/core/commands/cat.py
from filesystem import fs_manager
import json

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

    if stdin_data:
        output_parts.extend(stdin_data.splitlines())

    for file_path in files:
        # VALIDATION IS KEY! We now check if the user has read permissions for the file
        # and execute permissions for all parent directories before proceeding.
        validation_result = fs_manager.validate_path(
            file_path,
            user_context,
            json.dumps({"expectedType": "file", "permissions": ["read"]})
        )

        if not validation_result.get("success"):
            # If they don't have permission, we tell them! Firmly but politely.
            error_msg = validation_result.get('error', 'An unknown error occurred')
            output_parts.append(f"cat: {file_path}: {error_msg}")
            continue

        try:
            node = validation_result.get("node")
            content = node.get('content', '')
            output_parts.extend(content.splitlines())
        except Exception as e:
            output_parts.append(f"cat: {file_path}: An unexpected error occurred - {repr(e)}")

    if not files and not stdin_data:
        return ""

    if flags.get('number'):
        numbered_output = []
        for i, line in enumerate(output_parts, 1):
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