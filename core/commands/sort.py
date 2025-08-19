# gem/core/commands/sort.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the sort command accepts."""
    return [
        {'name': 'numeric-sort', 'short': 'n', 'long': 'numeric-sort', 'takes_value': False},
        {'name': 'reverse', 'short': 'r', 'long': 'reverse', 'takes_value': False},
        {'name': 'unique', 'short': 'u', 'long': 'unique', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Sorts lines of text from files or standard input.
    """
    lines = []
    has_errors = False
    error_output = []


    if stdin_data:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                error_output.append(f"sort: {path}: No such file or directory")
                has_errors = True
                continue
            if node.get('type') != 'file':
                error_output.append(f"sort: {path}: Is a directory")
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
                "suggestion": "Please check the file paths provided."
            }
        }


    is_numeric = flags.get('numeric-sort', False)
    is_reverse = flags.get('reverse', False)
    is_unique = flags.get('unique', False)

    def sort_key(line):
        if is_numeric:
            try:
                # Attempt to convert the beginning of the line to a float for sorting
                return float(line.strip().split()[0])
            except (ValueError, IndexError):
                # If it fails, fall back to a large number to sort non-numeric lines last
                return float('inf')
        return line

    lines.sort(key=sort_key, reverse=is_reverse)

    if is_unique:
        unique_lines = []
        seen = set()
        for line in lines:
            if line not in seen:
                unique_lines.append(line)
                seen.add(line)
        lines = unique_lines

    final_output = "\n".join(lines)
    if error_output:
        return "\n".join(error_output) + "\n" + final_output

    return final_output

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sort - sort lines of text files

SYNOPSIS
    sort [OPTION]... [FILE]...

DESCRIPTION
    Write sorted concatenation of all FILE(s) to standard output. With no
    FILE, or when FILE is -, read standard input.

    -r, --reverse           reverse the result of comparisons
    -n, --numeric-sort      compare according to string numerical value
    -u, --unique            output only the first of an equal run
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: sort [-ru] [-n] [FILE]..."