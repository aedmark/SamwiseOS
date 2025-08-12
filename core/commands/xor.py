# gem/core/commands/xor.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {"success": False, "error": "xor: missing key operand"}

    key = args[0]
    file_path = args[1] if len(args) > 1 else None

    if not key:
        return {"success": False, "error": "xor: key cannot be empty"}

    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {"success": False, "error": f"xor: {file_path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"xor: {file_path}: Is a directory"}
        content = node.get('content', '')
    else:
        return {"success": False, "error": "xor: missing file operand when not using a pipe"}

    key_bytes = key.encode('utf-8')
    content_bytes = content.encode('utf-8')
    key_len = len(key_bytes)

    result_bytes = bytearray(byte ^ key_bytes[i % key_len] for i, byte in enumerate(content_bytes))

    return result_bytes.decode('utf-8', errors='replace')

def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    return "Usage: xor KEY [FILE]"