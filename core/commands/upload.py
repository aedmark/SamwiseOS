# gem/core/commands/upload.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Handles the file upload process with clear user feedback.
    """
    if args:
        return {"success": False, "error": "upload: command takes no arguments"}

    files_to_upload = kwargs.get('files')

    if not files_to_upload:
        # This is the first step: ask the browser to open the file dialog.
        return {
            "effect": "trigger_upload_dialog"
        }
    else:
        # This is the second step: process the files the user selected.
        output_messages = []
        for file_info in files_to_upload:
            try:
                # The JS side figures out the correct path for us.
                fs_manager.write_file(file_info['path'], file_info['content'], user_context)
                # Add a success message to our report!
                output_messages.append(f"Uploaded '{file_info['name']}' to {file_info['path']}")
            except Exception as e:
                # Add a helpful error message to our report!
                output_messages.append(f"Error uploading '{file_info['name']}': {repr(e)}")

        # Return the full report to the terminal.
        return "\\n".join(output_messages)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Uploads files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local machine to the current directory
    by opening the browser's native file selection dialog. It provides a
    status report for each selected file.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the upload command."""
    return "Usage: upload"