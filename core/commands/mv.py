# /core/commands/mv.py

from filesystem import fs_manager
import os

def define_flags():
    return {
        'flags': [],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {"success": False, "error": {"message": "mv: missing file operand", "suggestion": "Try 'mv <source> <destination>'."}}

    source_paths = args[:-1]
    destination_path = args[-1]

    dest_node = fs_manager.get_node(destination_path)

    if len(source_paths) > 1 and (not dest_node or dest_node.get('type') != 'directory'):
        return {"success": False, "error": {"message": f"mv: target '{destination_path}' is not a directory", "suggestion": "When moving multiple files, the destination must be a directory."}}

    for source_path in source_paths:
        try:
            fs_manager.rename_node(source_path, destination_path)
        except PermissionError as e:
            return {"success": False, "error": {"message": f"mv: {e}", "suggestion": "Check your permissions for both the source and destination paths."}}
        except FileNotFoundError as e:
            return {"success": False, "error": {"message": f"mv: cannot stat '{source_path}': {e}", "suggestion": "Check the spelling and path of the source file."}}
        except FileExistsError as e:
            return {"success": False, "error": {"message": f"mv: cannot move to '{destination_path}': {e}", "suggestion": "Choose a different name for the destination or remove the existing file first."}}
        except Exception as e:
            return {"success": False, "error": {"message": f"mv: an unexpected error occurred: {repr(e)}", "suggestion": "Please verify the source and destination paths."}}

    return ""

def man(args, flags, user_context, **kwargs):

    return """
NAME
    mv - move or rename files and directories

SYNOPSIS
    mv [SOURCE] [DESTINATION]
    mv [SOURCE...] [DIRECTORY]

DESCRIPTION
    Renames SOURCE to DESTINATION, or moves SOURCE(s) to DIRECTORY.
    If the last argument is an existing directory, the source file is moved into that directory.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: mv [SOURCE] [DESTINATION]"