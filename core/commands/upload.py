# gem/core/commands/upload.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Handles the file upload process.
    """
    if args:
        return {"success": False, "error": "upload: command takes no arguments"}

    files_to_upload = kwargs.get('files')

    if not files_to_upload:
        return {
            "effect": "trigger_upload_dialog"
        }
    else:
        output_messages = []
        for file_info in files_to_upload:
            try:
                # The path is now provided in the file_info dict from the JS side
                fs_manager.write_file(file_info['path'], file_info['content'], user_context)
                output_messages.append(f"Uploaded '{file_info['name']}' to {file_info['path']}")
            except Exception as e:
                output_messages.append(f"Error uploading '{file_info['name']}': {repr(e)}")
        return "\\n".join(output_messages)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Uploads files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local machine to the current directory
    by opening the browser's native file selection dialog.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the upload command."""
    return "Usage: upload"