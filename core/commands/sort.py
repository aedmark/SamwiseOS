# gem/core/commands/sort.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Sorts lines of text from files or standard input.
    """
    lines = []

    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"sort: {path}: No such file or directory"
            if node.get('type') != 'file':
                return f"sort: {path}: Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        return "" # No input, no output

    is_numeric = "-n" in flags or "--numeric-sort" in flags
    is_reverse = "-r" in flags or "--reverse" in flags
    is_unique = "-u" in flags or "--unique" in flags

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

    return "\n".join(lines)

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