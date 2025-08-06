# gem/core/commands/tail.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if "-f" in flags or "--follow" in flags:
        return "tail: -f flag is not supported in this version. Falling back to JS implementation."

    lines = []

    # Determine the number of lines to show
    line_count = 10
    if "-n" in flags:
        try:
            line_count = int(flags["-n"])
            if line_count < 0:
                line_count = 10 # Default on invalid negative number
        except (ValueError, TypeError):
            return f"tail: invalid number of lines: '{flags['-n']}'"

    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"tail: cannot open '{path}' for reading: No such file or directory"
            if node.get('type') != 'file':
                return f"tail: error reading '{path}': Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        return ""

    return "\n".join(lines[-line_count:])

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    tail - output the last part of files

SYNOPSIS
    tail [OPTION]... [FILE]...

DESCRIPTION
    Print the last 10 lines of each FILE to standard output.
    With no FILE, or when FILE is -, read standard input.

    -n, --lines=COUNT
          output the last COUNT lines, instead of the last 10
    -f, --follow
          output appended data as the file grows
          (NOTE: This feature is handled by the JS command layer)
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: tail [-n lines] [-f] [FILE]..."