# gem/core/commands/_upload_handler.py

import json
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    INTERNAL. Handles the file upload process after files have been gathered.
    This command expects to be called by the JS upload command.
    """
    if args:
        return {"success": False, "error": "_upload_handler: command takes no arguments"}

    files_to_upload = json.loads(stdin_data) if stdin_data else None

    if not files_to_upload:
        # This should never be called directly by a user.
        return {"success": False, "error": "_upload_handler: files data not provided. This command is for internal use."}

    output_messages = []
    for file_info in files_to_upload:
        try:
            fs_manager.write_file(file_info['path'], file_info['content'], user_context)
            output_messages.append(f"Uploaded '{file_info['name']}' to {file_info['path']}")
        except Exception as e:
            return {"success": False, "error": f"Error uploading '{file_info['name']}': {repr(e)}"}

    # Return a standard success object with the output messages.
    return {
        "success": True,
        "output": "\n".join(output_messages)
    }

# No man or help page for internal commands.
def man(args, flags, user_context, **kwargs):
    return ""

def help(args, flags, user_context, **kwargs):
    return ""