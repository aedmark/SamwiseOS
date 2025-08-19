# gem/core/commands/cksum.py

import zlib
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    output_lines = []
    error_messages = []

    def process_content(content, name=""):
        string_content = str(content or "")
        content_bytes = string_content.encode('utf-8')
        checksum = zlib.crc32(content_bytes)
        byte_count = len(content_bytes)
        line = f"{checksum} {byte_count}"
        if name:
            line += f" {name}"
        return line

    if stdin_data is not None:
        output_lines.append(process_content(stdin_data))
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                error_messages.append(f"cksum: {path}: No such file or directory")
                continue
            if node.get('type') == 'directory':
                error_messages.append(f"cksum: {path}: Is a directory")
                continue

            content = node.get('content', '')
            output_lines.append(process_content(content, path))
    else:
        # Handles 'cksum' with no args and no stdin.
        output_lines.append(process_content(""))

    # If any errors occurred, we return a structured error object.
    if error_messages:
        return {
            "success": False,
            "error": {
                "message": "\n".join(error_messages),
                "suggestion": "Please ensure the file paths are correct and do not point to directories."
            }
        }

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    cksum - checksum and count the bytes in a file

SYNOPSIS
    cksum [FILE]...

DESCRIPTION
    The cksum utility calculates and writes to standard output a single line for each input file. The line consists of the CRC checksum of the file, the number of bytes in the file, and the name of the file. If no file is specified, cksum reads from standard input.

OPTIONS
    This command takes no options.

EXAMPLES
    cksum my_file.txt
    ls | cksum
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the cksum command."""
    return "Usage: cksum [FILE]..."