# gem/core/commands/ocrypt.py

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the ocrypt command accepts."""
    return [
        {'name': 'decrypt', 'short': 'd', 'long': 'decrypt', 'takes_value': False},
    ]

def _derive_key(password: bytes, salt: bytes) -> bytes:
    """Derives a cryptographic key from a password and salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password))

def run(args, flags, user_context, **kwargs):
    if len(args) < 2:
        return {"success": False, "error": "ocrypt: missing operands. Usage: ocrypt [-d] <password> <input_file> [output_file]"}

    is_decrypt = flags.get('decrypt', False)
    password, input_file_path = args[0], args[1]
    output_file_path = args[2] if len(args) > 2 else None

    input_node = fs_manager.get_node(input_file_path)
    if not input_node:
        return {"success": False, "error": f"ocrypt: {input_file_path}: No such file or directory"}

    input_content = input_node.get('content', '')
    password_bytes = password.encode('utf-8')

    try:
        if is_decrypt:
            decoded_data = base64.b64decode(input_content)
            salt, encrypted_data = decoded_data[:16], decoded_data[16:]
            key = _derive_key(password_bytes, salt)
            f = Fernet(key)
            decrypted_data = f.decrypt(encrypted_data)
            output_content = decrypted_data.decode('utf-8')
        else: # Encrypt
            salt = os.urandom(16)
            key = _derive_key(password_bytes, salt)
            f = Fernet(key)
            encrypted_data = f.encrypt(input_content.encode('utf-8'))
            output_content = base64.b64encode(salt + encrypted_data).decode('utf-8')

        if output_file_path:
            fs_manager.write_file(output_file_path, output_content, user_context)
            return "" # Success, no output to stdout
        else:
            return output_content

    except Exception:
        return {"success": False, "error": "ocrypt: decryption failed. Incorrect password or corrupt data."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ocrypt - securely encrypt and decrypt files

SYNOPSIS
    ocrypt [-d] password infile [outfile]

DESCRIPTION
    Encrypts or decrypts a file using AES-256. If outfile is not specified,
    output is written to standard out.

    -d, --decrypt
          Decrypt the input file.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ocrypt [-d] <password> <input_file> [output_file]"