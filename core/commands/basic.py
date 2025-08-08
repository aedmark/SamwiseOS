# gem/core/commands/basic.py
from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Gathers BASIC file information and returns an effect to launch the Basic IDE.
    """
    if len(args) > 1:
        return {"success": False, "error": "Usage: basic [filename.bas]"}

    file_path_arg = args[0] if args else None
    file_content = None
    resolved_path = None

    if file_path_arg:
        validation_result = fs_manager.validate_path(file_path_arg, user_context, '{"allowMissing": true, "expectedType": "file"}')
        if not validation_result.get("success"):
            return {"success": False, "error": f"basic: {validation_result.get('error')}"}

        resolved_path = validation_result.get("resolvedPath")
        node = validation_result.get("node")

        if node:
            if not fs_manager.has_permission(resolved_path, user_context, "read"):
                return {"success": False, "error": f"basic: cannot open '{file_path_arg}': Permission denied"}
            file_content = node.get('content', '')
        else:
            # If the file is missing, the manager expects empty content, not null.
            file_content = ""

    return {
        "effect": "launch_app",
        "app_name": "Basic",
        "options": {
            "path": resolved_path,
            "content": file_content
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    basic - The Oopis Basic Integrated Development Environment.

SYNOPSIS
    basic [filename.bas]

DESCRIPTION
    Launches a full-screen IDE for Oopis Basic. If a filename is
    provided, that file will be loaded into the editor buffer.
"""