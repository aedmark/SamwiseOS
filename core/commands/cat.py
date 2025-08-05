# gem/core/commands/cat.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    """
    Concatenates and displays the content of files.
    """
    if not args:
        return "" # `cat` with no arguments should do nothing and return success.

    output_parts = []
    for path_arg in args:
        try:
            node = fs_manager.get_node(path_arg)

            if not node:
                raise FileNotFoundError(f"cat: {path_arg}: No such file or directory")

            if node.get('type') == 'directory':
                raise IsADirectoryError(f"cat: {path_arg}: Is a directory")

            content = node.get('content', '')
            output_parts.append(content)

        except Exception as e:
            # Return the error message directly if one occurs
            return str(e)

    return "\n".join(output_parts)

def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the cat command.
    """
    return """
NAME
    cat - concatenate files and print on the standard output

SYNOPSIS
    cat [FILE]...

DESCRIPTION
    Concatenate FILE(s) to standard output.
    With no FILE, or when FILE is -, read standard input. (Note: stdin not supported in SamwiseOS).
"""

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the cat command.
    """
    return "Usage: cat [FILE...]"