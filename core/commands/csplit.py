# gem/core/commands/csplit.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the csplit command accepts."""
    return [
        {'name': 'prefix', 'short': 'f', 'long': 'prefix', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {"success": False, "error": "csplit: missing operand"}

    file_path = args[0]
    pattern = args[1]

    node = fs_manager.get_node(file_path)
    if not node:
        return {"success": False, "error": f"csplit: {file_path}: No such file or directory"}
    if node.get('type') != 'file':
        return {"success": False, "error": f"csplit: {file_path}: Is not a regular file"}

    content = node.get('content', '')
    lines = content.splitlines()

    try:
        line_num = int(pattern)
        if line_num <= 0 or line_num > len(lines):
            return {"success": False, "error": f"csplit: {file_path}: line {line_num} is out of range"}
    except ValueError:
        return {"success": False, "error": f"csplit: '{pattern}' is not a valid line number"}

    prefix = flags.get('prefix') or 'xx'

    content1 = "\n".join(lines[:line_num-1])
    file1_name = f"{prefix}00"
    fs_manager.write_file(file1_name, content1, user_context)

    content2 = "\n".join(lines[line_num-1:])
    file2_name = f"{prefix}01"
    fs_manager.write_file(file2_name, content2, user_context)

    return "" # Success

def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    """Provides help information for the csplit command."""
    return "Usage: csplit [OPTION]... FILE PATTERN..."