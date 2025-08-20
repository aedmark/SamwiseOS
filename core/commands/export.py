# gem/core/commands/export.py

from filesystem import fs_manager
import os

def run(args, flags, user_context, **kwargs):
    """
    Reads a file's content and returns an effect to trigger a download on the client side.
    """
    if not args:
        return {
            "success": False,
            "error": {
                "message": "export: missing file operand",
                "suggestion": "You must specify which file to export."
            }
        }
    if len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "export: too many arguments",
                "suggestion": "You can only export one file at a time."
            }
        }
    file_path = args[0]

    validation_result = fs_manager.validate_path(
        file_path,
        user_context,
        '{"expectedType": "file", "permissions": ["read"]}'
    )

    if not validation_result.get("success"):
        return {
            "success": False,
            "error": {
                "message": f"export: {validation_result.get('error')}",
                "suggestion": "Please ensure the file exists and you have read permissions."
            }
        }
    file_node = validation_result.get("node")
    file_content = file_node.get('content', '')
    file_name = os.path.basename(validation_result.get("resolvedPath"))

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
    export <file>

DESCRIPTION
    Initiates a browser download for the specified FILE, allowing you to save it from the virtual file system to your computer's local hard drive.

OPTIONS
    This command takes no options.

EXAMPLES
    export my_document.txt
    export /home/guest/backup.json
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: export <file>"