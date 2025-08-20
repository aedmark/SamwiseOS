# gem/core/commands/edit.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Gathers file information and returns an effect to launch the Editor UI.
    """
    if len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "edit: too many arguments",
                "suggestion": "The 'edit' command can only open one file at a time."
            }
        }
    file_path_arg = args[0] if args else None
    file_content = ""
    resolved_path = None

    if file_path_arg:
        validation_result = fs_manager.validate_path(file_path_arg, user_context, '{"allowMissing": true, "expectedType": "file"}')
        if not validation_result.get("success"):
            return {
                "success": False,
                "error": {
                    "message": f"edit: {validation_result.get('error')}",
                    "suggestion": "Please check the file path and your permissions."
                }
            }
        resolved_path = validation_result.get("resolvedPath")
        node = validation_result.get("node")

        if node:
            if not fs_manager.has_permission(resolved_path, user_context, "read"):
                return {
                    "success": False,
                    "error": {
                        "message": f"edit: cannot open '{file_path_arg}': Permission denied",
                        "suggestion": "Check the file's permissions with 'ls -l'."
                    }
                }
            file_content = node.get('content', '')

    return {
        "effect": "launch_app",
        "app_name": "Editor",
        "options": {
            "filePath": resolved_path,
            "fileContent": file_content
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    edit - A powerful, context-aware text and code editor.

SYNOPSIS
    edit [filepath]

DESCRIPTION
    Launches the SamwiseOS graphical text editor.
      - If a filepath is provided, it opens that file.
      - If the file does not exist, a new empty file will be created with that name upon saving.
      - If no filepath is given, it opens a new, untitled document.

OPTIONS
    This command takes no options.

EXAMPLES
    edit
    edit my_notes.txt
    edit /home/guest/projects/main.js
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: edit [filepath]"