# gem/core/commands/upload.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to trigger the browser's file upload dialog.
    """
    # This effect will be handled by the JavaScript CommandExecutor.
    return {
        "effect": "trigger_upload_dialog"
    }

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