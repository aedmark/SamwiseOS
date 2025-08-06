# gem/core/commands/unzip.py

import io
import zipfile
import os
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 1:
        return "unzip: missing file operand"

    archive_path = args[0]
    target_dir = args[1] if len(args) > 1 else "."

    archive_node = fs_manager.get_node(archive_path)
    if not archive_node:
        return f"unzip: cannot find or open {archive_path}"

    # The content is stored as base64 in our FS for binary files
    # We must decode it back to bytes to read the zip archive
    import base64
    try:
        # The content is not standard text, so we get it directly.
        # It should have been stored via our 'write_binary_file' effect.
        b64_content = archive_node.get('content', '')
        zip_bytes = base64.b64decode(b64_content)
        zip_buffer = io.BytesIO(zip_bytes)
    except (base64.binascii.Error, ValueError):
        return f"unzip: {archive_path} is not a valid zip archive (bad base64)"
    except Exception as e:
        return f"unzip: error reading archive: {repr(e)}"


    files_to_extract = []
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        for member in zipf.infolist():
            # Create a dictionary for each file/dir to be extracted
            item = {
                "path": os.path.join(target_dir, member.filename),
                "is_dir": member.is_dir(),
                "content": "" if member.is_dir() else zipf.read(member).decode('utf-8', 'replace')
            }
            files_to_extract.append(item)

    # Return a new effect for the JS side to handle the extraction
    return {
        "effect": "extract_archive",
        "files": files_to_extract
    }

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    unzip - list, test and extract compressed files in a ZIP archive

SYNOPSIS
    unzip archive.zip [destination_dir]

DESCRIPTION
    The unzip utility will extract files from a ZIP archive.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: unzip <archive.zip> [destination_dir]"