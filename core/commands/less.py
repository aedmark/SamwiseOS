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
            return {
                "success": False,
                "error": {
                    "message": f"less: {path}: No such file or directory",
                    "suggestion": "Please check the file path."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"less: {path}: Is a directory",
                    "suggestion": "The 'less' command can only view files."
                }
            }
        content = node.get('content', '')
    else:
        return ""

    return {
        "effect": "page_output",
        "content": content,
        "mode": "less"
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    less - opposite of more; a file perusal filter

SYNOPSIS
    less [file...]

DESCRIPTION
    Less is a program similar to 'more', but it allows backward movement in the file as well as forward movement. It opens a full-screen pager to view the content.

OPTIONS
    This command takes no options.

EXAMPLES
    less my_large_file.txt
    ls -la / | less
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: less [file...]"