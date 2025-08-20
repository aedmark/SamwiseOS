# gem/core/commands/zip.py

import io
import zipfile
import os
from filesystem import fs_manager
from datetime import datetime
import base64

def define_flags():
    """Declares the flags that the zip command accepts."""
    return {
        'flags': [],
        'metadata': {}
    }

def _add_to_zip(zip_buffer, path, archive_path=""):
    """Recursively adds a file or directory to the zip buffer."""
    node = fs_manager.get_node(path)
    if not node: return

    zip_info = zipfile.ZipInfo(os.path.join(archive_path, os.path.basename(path)))
    zip_info.date_time = datetime.now().timetuple()[:6]

    if node['type'] == 'file':
        zip_info.compress_type = zipfile.ZIP_DEFLATED
        zip_buffer.writestr(zip_info, node.get('content', '').encode('utf-8'))
    elif node['type'] == 'directory':
        # Add the directory entry itself
        zip_info.external_attr = 0o40755 << 16 # drwxr-xr-x
        zip_buffer.writestr(zip_info, '')

        new_archive_path = os.path.join(archive_path, os.path.basename(path))
        for child_name in node.get('children', {}):
            child_path = fs_manager.get_absolute_path(os.path.join(path, child_name))
            _add_to_zip(zip_buffer, child_path, new_archive_path)

def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {
            "success": False,
            "error": {
                "message": "zip: missing operand",
                "suggestion": "Try 'zip <archive.zip> <file_or_dir>...'"
            }
        }

    archive_name, source_paths = args[0], args[1:]
    in_memory_zip = io.BytesIO()

    with zipfile.ZipFile(in_memory_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for path in source_paths:
            _add_to_zip(zipf, path)

    zip_content_b64 = base64.b64encode(in_memory_zip.getvalue()).decode('utf-8')

    try:
        fs_manager.write_file(archive_name, zip_content_b64, user_context)
        return f"  adding: {', '.join(source_paths)} (deflated 0%)" # Simplified output
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "zip: failed to write archive",
                "suggestion": f"An unexpected error occurred: {repr(e)}"
            }
        }


def man(args, flags, user_context, **kwargs):
    return """
NAME
    zip - package and compress (archive) files

SYNOPSIS
    zip archive.zip file...

DESCRIPTION
    zip is a compression and file packaging utility. It puts one or more
    files into a single zip archive. Directories are archived recursively.
    The resulting archive is base64-encoded to be stored as a text file.

OPTIONS
    This command takes no options.

EXAMPLES
    zip my_project.zip README.md src/
    zip backup.zip /home/guest
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: zip <archive.zip> <file_or_dir>..."