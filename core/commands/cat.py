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
    Concatenates files and prints them to the standard output, now with proper permission checks.
    """
    output_parts = []
    files = args
    had_error = False
    error_messages = []

    if stdin_data:
        output_parts.extend(stdin_data.splitlines())

    for file_path in files:
        validation_result = fs_manager.validate_path(
            file_path,
            user_context,
            json.dumps({"permissions": ["read"]}) # We just need read permission
        )

        if not validation_result.get("success"):
            had_error = True
            error_msg = validation_result.get('error', 'An unknown error occurred')
            error_messages.append(f"cat: {file_path}: {error_msg}")
            continue

        node = validation_result.get("node")
        if node.get('type') != 'file':
            had_error = True
            error_messages.append(f"cat: {file_path}: Is not a file")
            continue

        try:
            content = node.get('content', '')
            output_parts.extend(content.splitlines())
        except Exception as e:
            had_error = True
            error_messages.append(f"cat: {file_path}: An unexpected error occurred - {repr(e)}")

    if not files and not stdin_data:
        return ""

    final_output_str = ""
    if flags.get('number'):
        numbered_output = []
        line_num = 1
        # We only number the actual content lines, not the error lines
        content_lines_to_process = [line for line in output_parts if not line.startswith("cat:")]
        for line in content_lines_to_process:
            numbered_output.append(f"     {line_num}  {line}")
            line_num += 1
        final_output_str = "\n".join(numbered_output)
    else:
        final_output_str = "\n".join(output_parts)

    if had_error:
        return {
            "success": False,
            "error": {
                "message": "\n".join(error_messages),
                "suggestion": "Verify the file paths and ensure you have read permissions."
            }
        }

    # Prepend errors to the output if some files failed but others succeeded
    if error_messages:
        final_output_str = "\n".join(error_messages) + "\n" + final_output_str

    return final_output_str


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