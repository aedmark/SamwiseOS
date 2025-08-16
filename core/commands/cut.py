# gem/core/commands/cut.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the cut command accepts."""
    return [
        {'name': 'characters', 'short': 'c', 'takes_value': True},
        {'name': 'fields', 'short': 'f', 'takes_value': True},
        {'name': 'delimiter', 'short': 'd', 'takes_value': True},
    ]

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
        return None
    return sorted(list(indices))

def run(args, flags, user_context, stdin_data=None, **kwargs):
    field_list_str = flags.get('fields')
    char_list_str = flags.get('characters')

    if not field_list_str and not char_list_str:
        return {"success": False, "error": "cut: you must specify a list of bytes, characters, or fields"}
    if field_list_str and char_list_str:
        return {"success": False, "error": "cut: only one type of list may be specified"}

    lines = []
    if stdin_data is not None:
        lines.extend(str(stdin_data or "").splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return {"success": False, "error": f"cut: {path}: No such file or directory"}
            if node.get('type') != 'file':
                return {"success": False, "error": f"cut: {path}: Is a directory"}
            lines.extend(node.get('content', '').splitlines())

    output_lines = []

    if field_list_str:
        field_list = _parse_range(field_list_str)
        if field_list is None:
            return {"success": False, "error": "cut: invalid field value"}
        delimiter = flags.get('delimiter', '\t')

        for line in lines:
            fields = line.split(delimiter)
            selected_fields = [fields[i] for i in field_list if i < len(fields)]
            output_lines.append(delimiter.join(selected_fields))

    elif char_list_str:
        char_list = _parse_range(char_list_str)
        if char_list is None:
            return {"success": False, "error": "cut: invalid character value"}

        for line in lines:
            new_line = "".join([line[i] for i in char_list if i < len(line)])
            output_lines.append(new_line)

    return "\n".join(output_lines)


def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    return "Usage: cut -c LIST [FILE]... or cut -f LIST [-d DELIM] [FILE]..."