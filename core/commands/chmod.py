# gem/core/commands/chmod.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    if len(args) != 2:
        return "chmod: missing operand. Usage: chmod <mode> <path>"

    mode_str = args[0]
    path = args[1]

    try:
        # Delegate the core logic to the FileSystemManager
        fs_manager.chmod(path, mode_str)
        return "" # Success
    except FileNotFoundError as e:
        return f"chmod: {e}"
    except ValueError as e:
        return f"chmod: {e}"
    except Exception as e:
        return f"chmod: an unexpected error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return """
NAME
    chmod - change file mode bits

SYNOPSIS
    chmod MODE FILE...

DESCRIPTION
    Changes the file mode bits of each given file according to mode,
    which can be an octal number.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return "Usage: chmod <mode> <path>"