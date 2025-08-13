# gem/core/commands/base64.py

import base64
import re
import binascii
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the base64 command accepts."""
    return [
        {'name': 'decode', 'short': 'd', 'long': 'decode', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    input_data = ""

    if stdin_data is not None:
        input_data = stdin_data
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return {"success": False, "error": f"base64: {path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"base64: {path}: Is a directory"}
        input_data = node.get('content', '')
    else:
        # If there's no file and no piped data, we should output nothing and succeed.
        return ""

    is_decode = flags.get('decode', False)

    try:
        # This prevents errors when input_data is None (JsNull).
        string_input = str(input_data or "")

        if is_decode:
            # Remove whitespace to handle potential formatting issues from various sources.
            cleaned_input = re.sub(r'\s+', '', string_input)
            input_bytes = cleaned_input.encode('utf-8')
            decoded_bytes = base64.b64decode(input_bytes)
            return decoded_bytes.decode('utf-8')
        else:
            # Encode the data
            input_bytes = string_input.encode('utf-8')
            encoded_bytes = base64.b64encode(input_bytes)
            return encoded_bytes.decode('utf-8')
    except (binascii.Error, UnicodeDecodeError) as e:
        # This catches errors specifically related to bad base64 data during decode.
        return {"success": False, "error": f"base64: invalid input: {e}"}
    except Exception as e:
        # This is a general catch-all for any other unexpected issues.
        return {"success": False, "error": f"base64: an unexpected error occurred: {e}"}


def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    base64 - base64 encode or decode data and print to standard output

SYNOPSIS
    base64 [OPTION]... [FILE]

DESCRIPTION
    Base64 encode or decode FILE, or standard input, to standard output.
    With no FILE, or when FILE is -, read standard input.

    -d, --decode
          decode data
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: base64 [-d] [FILE]"