# gem/core/commands/unzip.py

import io
import zipfile
import os
from filesystem import fs_manager
import base64

def run(args, flags, user_context, **kwargs):
    if len(args) < 1:
        return {
            "success": False,
            "error": {
                "message": "unzip: missing file operand",
                "suggestion": "Try 'unzip <archive.zip> [destination_dir]'"
            }
        }

    archive_path = args[0]
    target_dir = args[1] if len(args) > 1 else "."

    archive_node = fs_manager.get_node(archive_path)
    if not archive_node:
        return {
            "success": False,
            "error": {
                "message": f"unzip: cannot find or open {archive_path}",
                "suggestion": "Please check that the file path is correct."
            }
        }

    try:
        b64_content = archive_node.get('content', '')
        zip_bytes = base64.b64decode(b64_content)
        zip_buffer = io.BytesIO(zip_bytes)
    except Exception:
        return {
            "success": False,
            "error": {
                "message": f"unzip: '{archive_path}' is not a valid zip archive",
                "suggestion": "The file may be corrupted or not in zip format."
            }
        }

    output_messages = []
    try:
        with zipfile.ZipFile(zip_buffer, 'r') as zipf:
            file_list = sorted(zipf.infolist(), key=lambda f: f.filename)

            for member in file_list:
                dest_path = fs_manager.get_absolute_path(os.path.join(target_dir, member.filename))
                output_messages.append(f"  inflating: {dest_path}")

                if member.is_dir():
                    fs_manager.create_directory(dest_path, user_context, parents=True)
                else:
                    parent_dir = os.path.dirname(dest_path)
                    if not fs_manager.get_node(parent_dir):
                        fs_manager.create_directory(parent_dir, user_context, parents=True)

                    content_bytes = zipf.read(member)
                    content_str = content_bytes.decode('utf-8', 'replace')
                    fs_manager.write_file(dest_path, content_str, user_context)

        return f"Archive:  {archive_path}\n" + '\n'.join(output_messages)

    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "unzip: error during extraction",
                "suggestion": f"An unexpected error occurred: {repr(e)}"
            }
        }


def man(args, flags, user_context, **kwargs):
    return '''
NAME
    unzip - list, test and extract compressed files in a ZIP archive

SYNOPSIS
    unzip archive.zip [destination_dir]

DESCRIPTION
    The unzip utility will extract files from a ZIP archive created by the 'zip'
    command. If a destination directory is specified, files will be extracted
    there; otherwise, they are extracted to the current directory.

OPTIONS
    This command takes no options.

EXAMPLES
    unzip my_project.zip
    unzip my_photos.zip /home/guest/pictures
'''

def help(args, flags, user_context, **kwargs):
    return "Usage: unzip <archive.zip> [destination_dir]"