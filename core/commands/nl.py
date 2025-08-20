# /core/commands/nl.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    lines = []
    has_errors = False
    error_output = []

    if stdin_data is not None:
        lines.extend(str(stdin_data or "").splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                error_output.append(f"nl: {path}: No such file or directory")
                has_errors = True
                continue
            if node.get('type') != 'file':
                error_output.append(f"nl: {path}: Is a directory")
                has_errors = True
                continue
            lines.extend(node.get('content', '').splitlines())
    else:
        return "" # No input, no output

    if has_errors and not lines:
        return {
            "success": False,
            "error": {
                "message": "\n".join(error_output),
                "suggestion": "Please check the file paths."
            }
        }

    output_lines = []
    line_number = 1
    for line in lines:
        if line.strip():
            output_lines.append(f"{str(line_number).rjust(6)}\t{line}")
            line_number += 1
        else:
            output_lines.append("")

    final_output_str = "\n".join(output_lines)

    if error_output:
        return "\n".join(error_output) + "\n" + final_output_str

    return final_output_str

def man(args, flags, user_context, **kwargs):
    return """
NAME
    nl - number lines of files

SYNOPSIS
    nl [FILE]...

DESCRIPTION
    Write each FILE to standard output, with line numbers added to
    non-empty lines. With no FILE, or when FILE is -, read standard input.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: nl [FILE]..."