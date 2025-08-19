# gem/core/commands/sed.py

import re
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the sed command accepts."""
    return {
        'flags': [],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "sed: missing expression",
                "suggestion": "Try 'sed \"s/old/new/g\" <file>'."
            }
        }

    expression = args[0]
    file_path = args[1] if len(args) > 1 else None

    match = re.match(r's/(.*?)/(.*?)/([g]*)', expression)
    if not match:
        return {
            "success": False,
            "error": {
                "message": f"sed: unknown or unsupported command: {expression}",
                "suggestion": "This version of sed only supports the 's/old/new/g' format."
            }
        }

    pattern, replacement, s_flags = match.groups()

    lines = []
    if stdin_data is not None:
        lines = stdin_data.splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {
                "success": False,
                "error": {
                    "message": f"sed: {file_path}: No such file or directory",
                    "suggestion": "Please check the file path."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"sed: {file_path}: Is a directory",
                    "suggestion": "Sed can only operate on files, not directories."
                }
            }
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
            return {
                "success": False,
                "error": {
                    "message": f"sed: regex error in pattern '{pattern}': {e}",
                    "suggestion": "Check your regular expression for syntax errors."
                }
            }

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