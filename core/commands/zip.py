# gem/core/commands/zip.py

import io
import zipfile
import os
from filesystem import fs_manager
from datetime import datetime

def _add_to_zip(zip_buffer, path, archive_path=""):
    """Recursively adds a file or directory to the zip buffer."""
    node = fs_manager.get_node(path)
    if not node:
        return

    # Create a ZipInfo object to hold metadata
    # We use datetime now() because our nodes don't store creation time
    zip_info = zipfile.ZipInfo(os.path.join(archive_path, os.path.basename(path)))
    zip_info.date_time = datetime.now().timetuple()[:6]

    if node['type'] == 'file':
        zip_info.compress_type = zipfile.ZIP_DEFLATED
        zip_buffer.writestr(zip_info, node.get('content', '').encode('utf-8'))
    elif node['type'] == 'directory':
        # For directories, the archive path is the directory itself
        new_archive_path = os.path.join(archive_path, os.path.basename(path))
        for child_name, child_node in node.get('children', {}).items():
            child_path = fs_manager.get_absolute_path(os.path.join(path, child_name))
            _add_to_zip(zip_buffer, child_path, new_archive_path)


def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) < 2:
        return "zip: missing operand. Usage: zip <archive.zip> <file_or_dir>..."

    archive_name = args[0]
    source_paths = args[1:]

    # Use an in-memory buffer to build the zip file
    in_memory_zip = io.BytesIO()

    with zipfile.ZipFile(in_memory_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for path in source_paths:
            _add_to_zip(zipf, path)

    # Get the binary content of the zip file
    zip_content_bytes = in_memory_zip.getvalue()

    # The content of a zip file is binary, not valid UTF-8 text.
    # We must represent it in a way that is safe for JSON, so we use base64.
    import base64
    zip_content_b64 = base64.b64encode(zip_content_bytes).decode('utf-8')

    # We return a special effect to tell the JS side to handle a binary file write
    return {
        "effect": "write_binary_file",
        "path": archive_name,
        "b64_content": zip_content_b64
    }

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    zip - package and compress (archive) files

SYNOPSIS
    zip archive.zip file...

DESCRIPTION
    zip is a compression and file packaging utility. It puts one or more
    files into a single zip archive. Directories are archived recursively.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: zip <archive.zip> <file_or_dir>..."