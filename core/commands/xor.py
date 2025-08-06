# gem/core/commands/xor.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    if not args:
        return "xor: missing key operand"

    key = args[0]
    file_path = args[1] if len(args) > 1 else None

    if not key:
        return "xor: key cannot be empty"

    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return f"xor: {file_path}: No such file or directory"
        if node.get('type') != 'file':
            return f"xor: {file_path}: Is a directory"
        content = node.get('content', '')
    else:
        return "xor: missing file operand when not using a pipe"

    key_bytes = key.encode('utf-8')
    content_bytes = content.encode('utf-8')
    key_len = len(key_bytes)

    result_bytes = bytearray()
    for i, byte in enumerate(content_bytes):
        result_bytes.append(byte ^ key_bytes[i % key_len])

    # Try to decode back to string, replace errors if it's not valid utf-8
    return result_bytes.decode('utf-8', errors='replace')

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    xor - perform XOR encryption/decryption

SYNOPSIS
    xor KEY [FILE]

DESCRIPTION
    Encrypts or decrypts the given FILE or standard input using a repeating
    XOR cipher with the provided KEY. The command is its own inverse;
    running it a second time with the same key will decrypt the content.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: xor KEY [FILE]"