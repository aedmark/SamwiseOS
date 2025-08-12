# gem/core/commands/base64.py

import base64
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
        return "" # No input, no output

    is_decode = flags.get('decode', False)

    try:
        if is_decode:
            input_bytes = input_data.encode('utf-8')
            missing_padding = len(input_bytes) % 4
            if missing_padding:
                input_bytes += b'=' * (4 - missing_padding)
            decoded_bytes = base64.b64decode(input_bytes)
            return decoded_bytes.decode('utf-8')
        else:
            input_bytes = input_data.encode('utf-8')
            encoded_bytes = base64.b64encode(input_bytes)
            return encoded_bytes.decode('utf-8')
    except Exception as e:
        return {"success": False, "error": "base64: invalid input"}

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