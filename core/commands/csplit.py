# gem/core/commands/csplit.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the csplit command accepts."""
    return [
        {'name': 'prefix', 'short': 'f', 'long': 'prefix', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 2:
        return "csplit: missing operand"

    file_path = args[0]
    pattern = args[1]

    node = fs_manager.get_node(file_path)
    if not node:
        return f"csplit: {file_path}: No such file or directory"
    if node.get('type') != 'file':
        return f"csplit: {file_path}: Is not a regular file"

    content = node.get('content', '')
    lines = content.splitlines()

    try:
        line_num = int(pattern)
        if line_num <= 0 or line_num > len(lines):
            return f"csplit: {file_path}: line {line_num} is out of range"
    except ValueError:
        # For now, we only support line number patterns.
        # A full implementation would support regex patterns.
        return f"csplit: '{pattern}' is not a valid line number"

    prefix = flags.get('prefix') or 'xx'

    # Part 1: lines before the split point
    content1 = "\n".join(lines[:line_num-1])
    file1_name = f"{prefix}00"
    fs_manager.write_file(file1_name, content1, user_context)

    # Part 2: lines from the split point to the end
    content2 = "\n".join(lines[line_num-1:])
    file2_name = f"{prefix}01"
    fs_manager.write_file(file2_name, content2, user_context)

    return "" # Success

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    csplit - split a file into sections determined by context lines

SYNOPSIS
    csplit [OPTION]... FILE PATTERN...

DESCRIPTION
    Output pieces of FILE separated by PATTERN(s) to files 'xx00', 'xx01', ...,
    and output the size of each piece in bytes.

    -f, --prefix=PREFIX
          use PREFIX instead of 'xx'
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: csplit [OPTION]... FILE PATTERN..."