# gem/core/commands/wget.py
from pyodide.http import pyfetch
from filesystem import fs_manager
import asyncio

def define_flags():
    """Declares the flags that the wget command accepts."""
    return [
        {'name': 'output-document', 'short': 'O', 'long': 'output-document', 'takes_value': True},
    ]

async def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "wget: missing URL"}

    url = args[0]
    output_path = flags.get('output-document')

    if not output_path:
        try:
            # A more robust way to get the filename from a URL
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            output_path = os.path.basename(parsed_url.path) or "index.html"
        except (ImportError, IndexError):
            output_path = "index.html"

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        response = await pyfetch(url, method="GET", headers={'User-Agent': 'SamwiseOS/1.0'})

        if response.status != 200:
            return {"success": False, "error": f"wget: server response: {response.status} {response.status_text}"}

        content_str = await response.string()
        fs_manager.write_file(output_path, content_str, user_context)

        return f"'{output_path}' saved"

    except Exception as e:
        # pyfetch can raise various errors, including TypeError for network issues
        error_message = repr(e)
        if "Failed to fetch" in error_message:
            return {"success": False, "error": f"wget: cannot connect to host: {url}"}
        return {"success": False, "error": f"wget: an unexpected error occurred: {error_message}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    wget - The non-interactive network downloader.

SYNOPSIS
    wget [OPTION]... [URL]

DESCRIPTION
    wget is a utility for non-interactive download of files from the Web.
    It supports HTTP, HTTPS protocols.

-O, --output-document=FILE
    The documents will not be written to the appropriate files, but all
    will be concatenated and written to FILE.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: wget [-O file] [URL]"