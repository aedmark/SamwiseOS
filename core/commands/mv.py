# gem/core/commands/mv.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Moves or renames a source file/directory to a destination.
    """
    if len(args) != 2:
        return {"success": False, "error": "mv: missing destination file operand after ‘{}’".format(args[0]) if args else "mv: missing file operand"}

    source_path = args[0]
    destination_path = args[1]

    # We must check if the destination is a directory.
    # If it is, the final path for the moved item should be INSIDE that directory.
    dest_node = fs_manager.get_node(destination_path)
    if dest_node and dest_node.get('type') == 'directory':
        # Construct the new path by joining the destination directory and the source's basename.
        source_basename = os.path.basename(source_path)
        final_destination_path = os.path.join(destination_path, source_basename)
    else:
        # Otherwise, it's a direct rename.
        final_destination_path = destination_path

    try:
        # Call the powerful rename_node function with the correctly determined final path.
        fs_manager.rename_node(source_path, final_destination_path)
        return ""  # Success!
    except FileNotFoundError as e:
        return {"success": False, "error": f"mv: cannot move '{source_path}': No such file or directory"}
    except FileExistsError as e:
        return {"success": False, "error": f"mv: cannot move to '{destination_path}': Destination exists"}
    except Exception as e:
        # A catch-all for other potential filesystem issues
        return {"success": False, "error": f"mv: an unexpected error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
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

    This command is powered by the core Python filesystem for maximum reliability.
"""

def help(args, flags, user_context, **kwargs):
    """
    Provides help information for the mv command.
    """
    return "Usage: mv [SOURCE] [DESTINATION]"