# gem/core/commands/less.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Prepares content for the pager in 'less' mode.
    """
    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return {"success": False, "error": f"less: {path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"less: {path}: Is a directory"}
        content = node.get('content', '')
    else:
        return "" # No input, no output

    return {
        "effect": "page_output",
        "content": content,
        "mode": "less"
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    less - opposite of more

SYNOPSIS
    less [file...]

DESCRIPTION
    Less is a program similar to more, but it allows backward
    movement in the file as well as forward movement.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the less command."""
    return "Usage: less [file...]"