# gem/core/commands/upload.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Handles the file upload process with clear user feedback.
    This command now expects to be called by an effect that has already
    gathered the files from the user.
    """
    if args:
        return {"success": False, "error": "upload: command takes no arguments"}

    files_to_upload = kwargs.get('files')

    if not files_to_upload:
        # If called directly without the file dialog effect, trigger it.
        # This maintains command-line usability.
        return {
            "effect": "trigger_upload_dialog",
            "output": "Opening file dialog..."
        }

    # Process the files that were provided by the effect.
    output_messages = []
    for file_info in files_to_upload:
        try:
            # We assume the path has been confirmed/handled by the JS layer
            fs_manager.write_file(file_info['path'], file_info['content'], user_context)
            output_messages.append(f"Uploaded '{file_info['name']}' to {file_info['path']}")
        except Exception as e:
            # Return a specific error for the file that failed.
            return {"success": False, "error": f"Error uploading '{file_info['name']}': {repr(e)}"}

    # Return a standard success object with the output messages.
    return {
        "success": True,
        "output": "\n".join(output_messages)
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Uploads files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local machine to the current directory
    by opening the browser's native file selection dialog. It provides a
    status report for each selected file. If a file with the same name
    already exists, it will ask for confirmation before overwriting.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the upload command."""
    return "Usage: upload"