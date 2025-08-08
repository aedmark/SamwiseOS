# gem/core/commands/paint.py

from filesystem import fs_manager
import time
import os

def run(args, flags, user_context, **kwargs):
    """
    Gathers file information and returns an effect to launch the Paint UI.
    """
    if len(args) > 1:
        return {"success": False, "error": "Usage: paint [filename.oopic]"}

    # If no path is provided, generate a default name, just like the JS version.
    file_path_arg = args[0] if args else f"untitled-{int(time.time())}.oopic"

    # The paint application requires a specific file extension.
    if not file_path_arg.endswith('.oopic'):
        return {"success": False, "error": "paint: can only edit .oopic files."}

    file_content = ""

    # Validate the path, allowing it to be a new, non-existent file.
    validation_result = fs_manager.validate_path(file_path_arg, user_context, '{"allowMissing": true, "expectedType": "file"}')

    if not validation_result.get("success"):
        return {"success": False, "error": f"paint: {validation_result.get('error')}"}

    resolved_path = validation_result.get("resolvedPath")
    node = validation_result.get("node")

    if node:
        # Check for read permissions if the file exists.
        if not fs_manager.has_permission(resolved_path, user_context, "read"):
            return {"success": False, "error": f"paint: cannot open '{file_path_arg}': Permission denied"}
        file_content = node.get('content', '')

    # This effect launches the existing JavaScript-based Paint UI.
    return {
        "effect": "launch_app",
        "app_name": "Paint",
        "options": {
            "filePath": resolved_path,
            "fileContent": file_content
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    paint - Opens the character-based art editor.

SYNOPSIS
    paint [filename.oopic]

DESCRIPTION
    Launches the OopisOS character-based art editor. If a filename is
    provided, it will be opened. Files must have the '.oopic' extension.
"""