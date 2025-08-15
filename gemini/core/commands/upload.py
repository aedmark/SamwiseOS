# gem/core/commands/upload.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to trigger the browser's file upload workflow.
    """
    if args:
        return {"success": False, "error": "upload: command takes no arguments"}

    return {"effect": "trigger_upload_flow"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    upload - Upload files from your local machine to SamwiseOS.

SYNOPSIS
    upload

DESCRIPTION
    Initiates a file upload from your local machine to the current directory
    by opening the browser's native file selection dialog.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the upload command."""
    return "Usage: upload"