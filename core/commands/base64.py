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
            return {
                "success": False,
                "error": {
                    "message": f"base64: {path}: No such file or directory",
                    "suggestion": "Please check the file path."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"base64: {path}: Is a directory",
                    "suggestion": "Base64 can only operate on files."
                }
            }
        input_data = node.get('content', '')
    else:
        return ""

    is_decode = flags.get('decode', False)

    try:
        string_input = str(input_data or "")

        if is_decode:
            cleaned_input = re.sub(r'\s+', '', string_input)
            input_bytes = cleaned_input.encode('utf-8')
            decoded_bytes = base64.b64decode(input_bytes)
            return decoded_bytes.decode('utf-8')
        else:
            input_bytes = string_input.encode('utf-8')
            encoded_bytes = base64.b64encode(input_bytes)
            return encoded_bytes.decode('utf-8')
    except (binascii.Error, UnicodeDecodeError) as e:
        return {
            "success": False,
            "error": {
                "message": f"base64: invalid input",
                "suggestion": "The input data is not valid base64. Check for corruption or incorrect format."
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "base64: an unexpected error occurred",
                "suggestion": f"Details: {repr(e)}"
            }
        }


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