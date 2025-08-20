# gem/core/commands/cut.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the cut command accepts."""
    return {
        'flags': [
            {'name': 'characters', 'short': 'c', 'takes_value': True},
            {'name': 'fields', 'short': 'f', 'takes_value': True},
            {'name': 'delimiter', 'short': 'd', 'takes_value': True},
        ],
        'metadata': {}
    }

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
        return {
            "success": False,
            "error": {
                "message": "cut: you must specify a list of bytes, characters, or fields",
                "suggestion": "Try 'cut -c 1-5' or 'cut -f 1 -d \",\"'."
            }
        }
    if field_list_str and char_list_str:
        return {
            "success": False,
            "error": {
                "message": "cut: only one type of list may be specified",
                "suggestion": "Please use either -c for characters or -f for fields, but not both."
            }
        }

    lines = []
    if stdin_data is not None:
        lines.extend(str(stdin_data or "").splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return {
                    "success": False,
                    "error": {
                        "message": f"cut: {path}: No such file or directory",
                        "suggestion": "Check the spelling and path of the file."
                    }
                }
            if node.get('type') != 'file':
                return {
                    "success": False,
                    "error": {
                        "message": f"cut: {path}: Is a directory",
                        "suggestion": "The cut command can only process files."
                    }
                }
            lines.extend(node.get('content', '').splitlines())

    output_lines = []

    if field_list_str:
        field_list = _parse_range(field_list_str)
        if field_list is None:
            return {
                "success": False,
                "error": {
                    "message": f"cut: invalid field value: '{field_list_str}'",
                    "suggestion": "Field values must be a comma-separated list of numbers or ranges (e.g., '1,3,5-7')."
                }
            }
        delimiter = flags.get('delimiter', '\t')

        for line in lines:
            fields = line.split(delimiter)
            selected_fields = [fields[i] for i in field_list if i < len(fields)]
            output_lines.append(delimiter.join(selected_fields))

    elif char_list_str:
        char_list = _parse_range(char_list_str)
        if char_list is None:
            return {
                "success": False,
                "error": {
                    "message": f"cut: invalid character value: '{char_list_str}'",
                    "suggestion": "Character values must be a comma-separated list of numbers or ranges (e.g., '1,3,5-7')."
                }
            }

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
    Print selected parts of lines from each FILE to standard output. With no FILE, or when FILE is -, read standard input.

OPTIONS
    -c, --characters=LIST
        Select only these characters. LIST is a comma-separated list of numbers and ranges (e.g., 1,3,5-7).
    -f, --fields=LIST
        Select only these fields. LIST is a comma-separated list of numbers and ranges.
    -d, --delimiter=DELIM
        Use DELIM instead of TAB for the field delimiter.

EXAMPLES
    cut -c 1-10 my_file.txt
    ls -l | cut -c 1-10
    cut -d ':' -f 1,3 /etc/passwd
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: cut -c LIST [FILE]... or cut -f LIST [-d DELIM] [FILE]..."