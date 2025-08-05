# gem/core/commands/mv.py

from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Moves or renames a source file/directory to a destination.
    """
    if len(args) != 2:
        return help(args, flags, user_context)

    source_path = args[0]
    destination_path = args[1]

    try:
        # This calls the powerful rename_node function we already built!
        fs_manager.rename_node(source_path, destination_path)
        return ""  # Success!
    except FileNotFoundError as e:
        return f"mv: cannot move '{source_path}': No such file or directory"
    except FileExistsError as e:
        return f"mv: cannot move to '{destination_path}': Destination exists"
    except Exception as e:
        # A catch-all for other potential filesystem issues
        return f"mv: an unexpected error occurred: {repr(e)}"

def man(args, flags, user_context):
    """
    Displays the manual page for the mv command.
    """
    return """
NAME
    mv - move or rename files and directories

SYNOPSIS
    mv [SOURCE] [DESTINATION]

DESCRIPTION
    Renames SOURCE to DESTINATION, or moves SOURCE(s) to DIRECTORY.
    If the last argument is an existing directory, the source file is moved into that directory.
    Otherwise, the source file is renamed to the destination name.

    This command is powered by the core Python filesystem for maximum reliability.
"""

def help(args, flags, user_context):
    """
    Provides help information for the mv command.
    """
    return "Usage: mv [SOURCE] [DESTINATION]"