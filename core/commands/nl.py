# gem/core/commands/nl.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    lines = []

    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"nl: {path}: No such file or directory"
            if node.get('type') != 'file':
                return f"nl: {path}: Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        return "" # No input, no output

    output_lines = []
    line_number = 1
    for line in lines:
        if line.strip():
            # Pad the line number to 6 spaces
            output_lines.append(f"{str(line_number).rjust(6)}\t{line}")
            line_number += 1
        else:
            output_lines.append("")

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    nl - number lines of files

SYNOPSIS
    nl [FILE]...

DESCRIPTION
    Write each FILE to standard output, with line numbers added to
    non-empty lines. With no FILE, read standard input.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: nl [FILE]..."