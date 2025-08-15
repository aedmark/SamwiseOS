# gem/core/commands/sed.py

import re
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the sed command accepts."""
    return []

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {"success": False, "error": "sed: missing expression"}

    expression = args[0]
    file_path = args[1] if len(args) > 1 else None

    match = re.match(r's/(.*?)/(.*?)/([g]*)', expression)
    if not match:
        return {"success": False, "error": f"sed: unknown command: {expression}"}

    pattern, replacement, s_flags = match.groups()

    lines = []
    if stdin_data is not None:
        lines = stdin_data.splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {"success": False, "error": f"sed: {file_path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"sed: {file_path}: Is a directory"}
        lines = node.get('content', '').splitlines()
    else:
        return ""

    output_lines = []
    count = 0 if 'g' in s_flags else 1

    for line in lines:
        try:
            new_line = re.sub(pattern, replacement, line, count=count)
            output_lines.append(new_line)
        except re.error as e:
            return {"success": False, "error": f"sed: regex error: {e}"}

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sed - stream editor for filtering and transforming text

SYNOPSIS
    sed [SCRIPT]... [FILE]...

DESCRIPTION
    sed is a stream editor. A stream editor is used to perform basic
    text transformations on an input stream (a file or input from a
    pipeline).

    Currently supports simple substitution: s/regexp/replacement/g
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: sed 's/pattern/replacement/g' [FILE]"