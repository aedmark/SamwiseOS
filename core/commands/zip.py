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

def _add_to_zip(zipf, path, archive_path=""):
    """Recursively adds a file or directory to the zip file."""
    node = fs_manager.get_node(path)
    if not node:
        return

    # The archive name for the current node
    current_archive_name = os.path.join(archive_path, os.path.basename(path))

    if node['type'] == 'file':
        zipf.writestr(current_archive_name, node.get('content', '').encode('utf-8'))
    elif node['type'] == 'directory':
        # For directories, recursively add their children.
        # An explicit directory entry is often not needed if it contains files,
        # but let's add it for empty directories.
        if not node.get('children'):
            zipf.writestr(current_archive_name + '/', b'')

        for child_name in node.get('children', {}):
            child_path = os.path.join(path, child_name)
            _add_to_zip(zipf, child_path, current_archive_name)


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
            # We start with an empty archive path for the top-level items.
            _add_to_zip(zipf, path, archive_path="")

    zip_content_b64 = base64.b64encode(in_memory_zip.getvalue()).decode('utf-8')

    try:
        fs_manager.write_file(archive_name, zip_content_b64, user_context)
        # Generate a more realistic output message.
        output_lines = [f"  adding: {p} (deflated 0%)" for p in source_paths]
        return "\n".join(output_lines)
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