# gem/core/commands/cat.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the cat command accepts."""
    return [
        {'name': 'number', 'short': 'n', 'long': 'number', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    """
    Concatenates and displays the content of files.
    """
    if not args and stdin_data is None:
        return ""

    output_parts = []

    # Handle stdin if present
    if stdin_data is not None:
        output_parts.extend(stdin_data.splitlines())

    # Handle file arguments
    if args:
        for path_arg in args:
            try:
                node = fs_manager.get_node(path_arg)
                if not node:
                    raise FileNotFoundError(f"cat: {path_arg}: No such file or directory")
                if node.get('type') == 'directory':
                    raise IsADirectoryError(f"cat: {path_arg}: Is a directory")
                output_parts.extend(node.get('content', '').splitlines())
            except Exception as e:
                return str(e)

    if flags.get('number'):
        numbered_lines = []
        for i, line in enumerate(output_parts):
            numbered_lines.append(f"     {i+1}  {line}")
        return "\n".join(numbered_lines)

    return "\n".join(output_parts)


def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the cat command.
    """
    return """
NAME
    cat - concatenate files and print on the standard output

SYNOPSIS
    cat [-n] [FILE]...

DESCRIPTION
    Concatenate FILE(s) to standard output.
    With no FILE, or when FILE is -, read standard input. (Note: stdin not supported in SamwiseOS).

    -n, --number
          number all output lines
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the cat command.
    """
    return "Usage: cat [-n] [FILE...]"