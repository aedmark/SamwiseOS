# gem/core/commands/edit.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Gathers file information and returns an effect to launch the Editor UI.
    """
    file_path_arg = args[0] if args else None
    file_content = ""
    resolved_path = None

    if file_path_arg:
        # Validate the path, allowing it to be a new, non-existent file
        validation_result = fs_manager.validate_path(file_path_arg, user_context, '{"allowMissing": true, "expectedType": "file"}')
        if not validation_result.get("success"):
            return {"success": False, "error": f"edit: {validation_result.get('error')}"}

        resolved_path = validation_result.get("resolvedPath")
        node = validation_result.get("node")

        if node:
            # Check for read permissions if the file exists
            if not fs_manager.has_permission(resolved_path, user_context, "read"):
                return {"success": False, "error": f"edit: cannot open '{file_path_arg}': Permission denied"}
            file_content = node.get('content', '')

    # This effect launches the existing JavaScript-based Editor UI
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
    Launches the OopisOS text editor.
      - If a filepath is provided, it opens that file.
      - If the file does not exist, a new empty file will be created with that name upon saving.
      - If no filepath is given, it opens a new, untitled document.
"""