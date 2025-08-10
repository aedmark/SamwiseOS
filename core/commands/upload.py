# gem/core/commands/upload.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Handles the file upload process. If no file data is provided, it
    returns an effect to trigger the browser's file upload dialog. If
    file data is provided (from the JS side), it writes the file to the VFS.
    """
    files_to_upload = kwargs.get('files')

    if not files_to_upload:
        # Phase 1: No files provided, trigger the dialog on the JS side
        return {
            "effect": "trigger_upload_dialog"
        }
    else:
        # Phase 2: Files are provided from JS, write them to the filesystem
        output_messages = []
        for file_info in files_to_upload:
            try:
                fs_manager.write_file(file_info['path'], file_info['content'], user_context)
                output_messages.append(f"Uploaded '{file_info['name']}' to {file_info['path']}")
            except Exception as e:
                output_messages.append(f"Error uploading '{file_info['name']}': {repr(e)}")
        return "\n".join(output_messages)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Uploads files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local machine to the current directory
    by opening the browser's native file selection dialog. This command is
    only available in interactive sessions.
"""