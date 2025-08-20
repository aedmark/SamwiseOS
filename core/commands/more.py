# gem/core/commands/more.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Prepares content for the pager in 'more' mode.
    """
    if len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "more: command takes at most one file argument",
                "suggestion": "Try 'more <file>' or pipe data into it, like 'ls -l | more'."
            }
        }

    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return {"success": False, "error": {"message": f"more: {path}: No such file or directory", "suggestion": "Please check the file path."}}
        if node.get('type') != 'file':
            return {"success": False, "error": {"message": f"more: {path}: Is a directory", "suggestion": "The 'more' command can only view files."}}

        if not fs_manager.has_permission(path, user_context, 'read'):
            return {"success": False, "error": {"message": f"more: {path}: Permission denied", "suggestion": "Check the file's permissions."}}

        content = node.get('content', '')
    else:
        # This case handles `more` with no args and no stdin. It should do nothing.
        return ""

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
    more [file]

DESCRIPTION
    more is a filter for paging through text one screenful at a time. It allows
    you to view the contents of a file or piped command output page by page.
    Press SPACE or 'f' to advance to the next page, and 'q' to quit.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: more [file]"