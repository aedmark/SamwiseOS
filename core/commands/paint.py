# gem/core/commands/paint.py

from filesystem import fs_manager
import time
import os

def run(args, flags, user_context, **kwargs):
    if len(args) > 1:
        return {"success": False, "error": {"message": "paint: too many arguments", "suggestion": "Usage: paint [filename.oopic]"}}

    file_path_arg = args[0] if args else f"untitled-{int(time.time())}.oopic"

    if not file_path_arg.endswith('.oopic'):
        return {"success": False, "error": {"message": "paint: invalid file type", "suggestion": "Paint can only create or edit .oopic files."}}

    file_content = ""
    validation_result = fs_manager.validate_path(file_path_arg, user_context, '{"allowMissing": true, "expectedType": "file"}')

    if not validation_result.get("success"):
        return {"success": False, "error": {"message": f"paint: {validation_result.get('error')}", "suggestion": "Check the file path and permissions."}}

    resolved_path = validation_result.get("resolvedPath")
    node = validation_result.get("node")

    if node:
        if not fs_manager.has_permission(resolved_path, user_context, "read"):
            return {"success": False, "error": {"message": f"paint: cannot open '{file_path_arg}': Permission denied", "suggestion": "Check the file's permissions with 'ls -l'."}}
        file_content = node.get('content', '')

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

def help(args, flags, user_context, **kwargs):
    return "Usage: paint [filename.oopic]"
