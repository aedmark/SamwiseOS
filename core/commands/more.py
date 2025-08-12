# gem/core/commands/more.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Prepares content for the pager in 'more' mode.
    """
    if len(args) > 1:
        return {"success": False, "error": "more: command takes at most one file argument"}

    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return {"success": False, "error": f"more: {path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"more: {path}: Is a directory"}
        content = node.get('content', '')
    else:
        return "" # No input, no output

    return {
        "effect": "page_output",
        "content": content,
        "mode": "more"
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    more - file perusal filter for CRT viewing

SYNOPSIS
    more [file...]

DESCRIPTION
    more is a filter for paging through text one screenful at a time.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the more command."""
    return "Usage: more [file...]"