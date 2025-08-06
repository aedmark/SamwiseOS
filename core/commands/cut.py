# gem/core/commands/cut.py

from filesystem import fs_manager

def _parse_range(list_str):
    """Parses a comma-separated list of numbers and ranges into a sorted list of zero-based indices."""
    indices = set()
    try:
        parts = list_str.split(',')
        for part in parts:
            if '-' in part:
                start, end = map(int, part.split('-'))
                if start > 0 and end >= start:
                    for i in range(start, end + 1):
                        indices.add(i - 1)
            else:
                num = int(part)
                if num > 0:
                    indices.add(num - 1)
    except ValueError:
        return None # Indicates a parsing error
    return sorted(list(indices))

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not flags.get('-f') and not flags.get('-c'):
        return "cut: you must specify a list of bytes, characters, or fields"

    if flags.get('-f') and flags.get('-c'):
        return "cut: only one type of list may be specified"

    lines = []
    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif len(args) > 1: # The program is the first arg for cut.js, here it's part of flags
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"cut: {path}: No such file or directory"
            if node.get('type') != 'file':
                return f"cut: {path}: Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        # If no stdin and no file, but flags are present, it should process empty input
        pass

    output_lines = []

    if '-f' in flags:
        field_list = _parse_range(flags['-f'])
        if field_list is None:
            return "cut: invalid field value"
        delimiter = flags.get('-d', '\t')

        for line in lines:
            fields = line.split(delimiter)
            selected_fields = [fields[i] for i in field_list if i < len(fields)]
            output_lines.append(delimiter.join(selected_fields))

    elif '-c' in flags:
        char_list = _parse_range(flags['-c'])
        if char_list is None:
            return "cut: invalid character value"

        for line in lines:
            new_line = "".join([line[i] for i in char_list if i < len(line)])
            output_lines.append(new_line)

    return "\n".join(output_lines)


def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    cut - remove sections from each line of files

SYNOPSIS
    cut OPTION... [FILE]...

DESCRIPTION
    Print selected parts of lines from each FILE to standard output.

    -c, --characters=LIST
          select only these characters
    -d, --delimiter=DELIM
          use DELIM instead of TAB for field delimiter
    -f, --fields=LIST
          select only these fields
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: cut -c LIST [FILE]... or cut -f LIST [-d DELIM] [FILE]..."