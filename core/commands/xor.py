# gem/core/commands/xor.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "xor: missing key operand",
                "suggestion": "You must provide a key for the XOR operation."
            }
        }


    key = args[0]
    file_path = args[1] if len(args) > 1 else None

    if not key:
        return {
            "success": False,
            "error": {
                "message": "xor: key cannot be empty",
                "suggestion": "Please provide a non-empty key."
            }
        }


    content = ""
    if stdin_data is not None:
        content = stdin_data
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {
                "success": False,
                "error": {
                    "message": f"xor: {file_path}: No such file or directory",
                    "suggestion": "Please check that the file path is correct."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"xor: {file_path}: Is a directory",
                    "suggestion": "The xor command can only operate on files."
                }
            }
        content = node.get('content', '')
    else:
        return {
            "success": False,
            "error": {
                "message": "xor: missing file operand when not using a pipe",
                "suggestion": "Please provide a file to process or pipe data into the command."
            }
        }

    string_content = str(content or "")

    key_bytes = key.encode('utf-8')
    content_bytes = string_content.encode('utf-8')
    key_len = len(key_bytes)

    result_bytes = bytearray(byte ^ key_bytes[i % key_len] for i, byte in enumerate(content_bytes))

    try:
        return result_bytes.decode('utf-8')
    except UnicodeDecodeError:
        # Fallback for binary data that doesn't decode cleanly to UTF-8
        return result_bytes.decode('latin-1')


def man(args, flags, user_context, **kwargs):
    return """
NAME
    xor - perform XOR encryption/decryption

SYNOPSIS
    xor KEY [FILE]

DESCRIPTION
    Encrypts or decrypts the given FILE or standard input using a repeating
    XOR cipher with the provided KEY. The command is its own inverse;
    running it a second time with the same key will decrypt the content. This
    is a simple cipher and should not be used for serious security.

OPTIONS
    This command takes no options.

EXAMPLES
    echo "secret message" | xor mykey > encrypted.txt
    cat encrypted.txt | xor mykey
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: xor KEY [FILE]"