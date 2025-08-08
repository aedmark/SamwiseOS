# gem/core/commands/export.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Reads a file's content and returns an effect to trigger a download on the client side.
    """
    if not args:
        return {"success": False, "error": "export: missing file operand"}

    file_path = args[0]

    # Use our robust validation from the filesystem manager
    validation_result = fs_manager.validate_path(
        file_path,
        user_context,
        '{"expectedType": "file", "permissions": ["read"]}'
    )

    if not validation_result.get("success"):
        return {"success": False, "error": f"export: {validation_result.get('error')}"}

    file_node = validation_result.get("node")
    file_content = file_node.get('content', '')
    file_name = os.path.basename(validation_result.get("resolvedPath"))

    # This effect tells the JavaScript CommandExecutor to trigger a browser download
    return {
        "effect": "export_file",
        "content": file_content,
        "filename": file_name
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    export - download a file from SamwiseOS to your local machine.

SYNOPSIS
    export [FILE]

DESCRIPTION
    Initiates a browser download for the specified FILE, allowing you to save
    it from the virtual file system to your computer.
"""