# gem/core/commands/upload.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to trigger the browser's file upload workflow.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "upload: command takes no arguments",
                "suggestion": "Simply run 'upload' by itself to open the file dialog."
            }
        }

    return {"effect": "trigger_upload_flow"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Upload files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local computer to the current directory
    in SamwiseOS by opening the browser's native file selection dialog. You
    can select multiple files to upload at once.

OPTIONS
    This command takes no options.

EXAMPLES
    upload
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: upload"