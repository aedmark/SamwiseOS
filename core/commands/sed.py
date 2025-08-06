# gem/core/commands/sed.py

import re
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not args:
        return "sed: missing expression"

    expression = args[0]
    file_path = args[1] if len(args) > 1 else None

    # Simple substitution parser: s/pattern/replacement/flags
    match = re.match(r's/(.*?)/(.*?)/([g]*)', expression)
    if not match:
        return f"sed: unknown command: {expression}"

    pattern, replacement, s_flags = match.groups()

    lines = []
    if stdin_data is not None:
        lines = stdin_data.splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return f"sed: {file_path}: No such file or directory"
        if node.get('type') != 'file':
            return f"sed: {file_path}: Is a directory"
        lines = node.get('content', '').splitlines()
    else:
        # sed waits for stdin if no file is provided
        return ""

    output_lines = []
    count = 1 if 'g' not in s_flags else 0

    for line in lines:
        try:
            new_line = re.sub(pattern, replacement, line, count=count)
            output_lines.append(new_line)
        except re.error as e:
            return f"sed: regex error: {e}"

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    sed - stream editor for filtering and transforming text

SYNOPSIS
    sed [SCRIPT]... [FILE]...

DESCRIPTION
    sed is a stream editor. A stream editor is used to perform basic
    text transformations on an input stream (a file or input from a
    pipeline). While in some ways similar to an editor which permits
    scripted edits (such as ed), sed works by making only one pass over
    the input(s), and is consequently more efficient.

    Currently supports simple substitution: s/regexp/replacement/g
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: sed 's/pattern/replacement/g' [FILE]"