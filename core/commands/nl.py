# gem/core/commands/nl.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    lines = []

    if args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return {"success": False, "error": f"nl: {path}: No such file or directory"}
            if node.get('type') != 'file':
                return {"success": False, "error": f"nl: {path}: Is a directory"}
            lines.extend(node.get('content', '').splitlines())
    elif stdin_data is not None:
        lines.extend(str(stdin_data or "").splitlines())
    else:
        return "" # No input, no output

    output_lines = []
    line_number = 1
    for line in lines:
        if line.strip():
            output_lines.append(f"{str(line_number).rjust(6)}\t{line}")
            line_number += 1
        else:
            output_lines.append("")

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    nl - number lines of files

SYNOPSIS
    nl [FILE]...

DESCRIPTION
    Write each FILE to standard output, with line numbers added to
    non-empty lines. With no FILE, read standard input.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: nl [FILE]..."