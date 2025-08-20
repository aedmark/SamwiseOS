# gem/core/commands/ocrypt.py

import base64
import os
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from filesystem import fs_manager

def define_flags():
    return {
        'flags': [
            {'name': 'decode', 'short': 'd', 'long': 'decode', 'takes_value': False},
        ],
        'metadata': {}
    }

def _derive_key(password: str, salt: bytes) -> bytes:
    """Derives a cryptographic key from a password and salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def run(args, flags, user_context, **kwargs):
    if len(args) != 3:
        return {
            "success": False,
            "error": {
                "message": "ocrypt: incorrect number of arguments.",
                "suggestion": "Try 'ocrypt <password> <input_file> <output_file>' or 'ocrypt -d ...'."
            }
        }

    is_decrypt = flags.get('decode', False)
    password, input_path, output_path = args[0], args[1], args[2]

    input_node = fs_manager.get_node(input_path)
    if not input_node or input_node.get('type') != 'file':
        return {
            "success": False,
            "error": { "message": f"ocrypt: input file not found or is a directory: {input_path}", "suggestion": "Please ensure the input file exists." }
        }

    input_content_bytes = input_node.get('content', '').encode('latin-1')

    try:
        if is_decrypt:
            if len(input_content_bytes) < 17: # 16 for salt + at least 1 for data
                return {"success": False, "error": {"message": "ocrypt: input file is not a valid encrypted file (too short).", "suggestion": "Ensure you are decrypting a file that was encrypted with ocrypt."}}
            salt = input_content_bytes[:16]
            encrypted_data = input_content_bytes[16:]
            key = _derive_key(password, salt)
            f = Fernet(key)
            decrypted_content = f.decrypt(encrypted_data)
            fs_manager.write_file(output_path, decrypted_content.decode('utf-8'), user_context)
            return "" # Success
        else:
            salt = os.urandom(16)
            key = _derive_key(password, salt)
            f = Fernet(key)
            content_to_encrypt_bytes = input_node.get('content', '').encode('utf-8')
            encrypted_content = f.encrypt(content_to_encrypt_bytes)
            content_to_write = salt + encrypted_content
            fs_manager.write_file(output_path, content_to_write.decode('latin-1'), user_context)
            return "" # Success

    except InvalidToken:
        return {
            "success": False,
            "error": { "message": "ocrypt: decryption failed.", "suggestion": "This is likely due to an incorrect password or a corrupted file." }
        }
    except Exception as e:
        return {
            "success": False,
            "error": { "message": f"ocrypt: an unexpected error occurred: {repr(e)}", "suggestion": "Please check the file paths and permissions." }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ocrypt - securely encrypt and decrypt files.

SYNOPSIS
    ocrypt [-d] password infile outfile

DESCRIPTION
    Encrypts or decrypts a file using a password. It uses a robust,
    salt-based key derivation function to protect against simple attacks.

    -d, --decode
          Decrypt the infile.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ocrypt [-d] <password> <input_file> <output_file>"