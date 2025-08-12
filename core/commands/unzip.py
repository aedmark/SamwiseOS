# gem/core/commands/unzip.py

import io
import zipfile
import os
from filesystem import fs_manager
import base64

def run(args, flags, user_context, **kwargs):
    if len(args) < 1:
        return {"success": False, "error": "unzip: missing file operand"}

    archive_path = args[0]
    target_dir = args[1] if len(args) > 1 else "."

    archive_node = fs_manager.get_node(archive_path)
    if not archive_node:
        return {"success": False, "error": f"unzip: cannot find or open {archive_path}"}

    try:
        b64_content = archive_node.get('content', '')
        zip_bytes = base64.b64decode(b64_content)
        zip_buffer = io.BytesIO(zip_bytes)
    except Exception:
        return {"success": False, "error": f"unzip: {archive_path} is not a valid zip archive"}

    files_to_extract = []
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        for member in zipf.infolist():
            item = {
                "path": os.path.join(target_dir, member.filename),
                "is_dir": member.is_dir(),
                "content": "" if member.is_dir() else zipf.read(member).decode('utf-8', 'replace')
            }
            files_to_extract.append(item)

    # This effect was never implemented on the JS side, so we'll do it here!
    try:
        for item in files_to_extract:
            if item['is_dir']:
                fs_manager.create_directory(item['path'], user_context)
            else:
                fs_manager.write_file(item['path'], item['content'], user_context)
        return f"Archive: {archive_path}\\n inflating: {', '.join([f['path'] for f in files_to_extract])}"
    except Exception as e:
        return {"success": False, "error": f"unzip: error during extraction: {repr(e)}"}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    unzip - list, test and extract compressed files in a ZIP archive

SYNOPSIS
    unzip archive.zip [destination_dir]

DESCRIPTION
    The unzip utility will extract files from a ZIP archive.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the unzip command."""
    return "Usage: unzip <archive.zip> [destination_dir]"