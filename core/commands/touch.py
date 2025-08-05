# gem/core/commands/touch.py

from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Updates the access and modification times of a file to the current time.
    If the file does not exist, it is created with empty content.
    """
    if not args:
        return help(args, flags, user_context)

    for path in args:
        try:
            # We'll use the robust write_file function which handles both creation and updates.
            # If the file exists, we'll re-write its existing content to update the timestamp.
            # If it doesn't exist, we'll write empty content to create it.

            node = fs_manager.get_node(path)
            if node:
                # File exists, "touch" it by writing its own content back to it.
                content = node.get('content', '')
                fs_manager.write_file(path, content, user_context)
            else:
                # File does not exist, create it empty.
                fs_manager.write_file(path, '', user_context)

        except IsADirectoryError:
            # fs_manager.write_file will raise an error if path is a directory, which is correct.
            # We can just ignore it, as `touch` on a directory should do nothing.
            pass
        except Exception as e:
            return f"touch: an unexpected error occurred with '{path}': {repr(e)}"

    return "" # Success

def man(args, flags, user_context):
    """
    Displays the manual page for the touch command.
    """
    return """
NAME
    touch - change file timestamps

SYNOPSIS
    touch [FILE]...

DESCRIPTION
    Update the access and modification times of each FILE to the current time.
    A FILE argument that does not exist is created empty.
"""

def help(args, flags, user_context):
    """
    Provides help information for the touch command.
    """
    return "Usage: touch [FILE...]"