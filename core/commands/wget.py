# gem/core/commands/wget.py

import urllib.request
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the wget command accepts."""
    return [
        {'name': 'output-document', 'short': 'O', 'long': 'output-document', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "wget: missing URL"}

    url = args[0]
    output_path = flags.get('output-document')

    if not output_path:
        try:
            output_path = url.split('/')[-1] or "index.html"
        except IndexError:
            output_path = "index.html"

    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    try:
        headers = {'User-Agent': 'SamwiseOS/1.0'}
        req = urllib.request.Request(url, headers=headers)

        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return {"success": False, "error": f"wget: server response: {response.status}"}

            content_bytes = response.read()
            content_str = content_bytes.decode('utf-8', errors='ignore')
            fs_manager.write_file(output_path, content_str, user_context)

        return f"'{output_path}' saved"

    except urllib.error.URLError as e:
        return {"success": False, "error": f"wget: {url}: {e.reason}"}
    except Exception as e:
        return {"success": False, "error": f"wget: an unexpected error occurred: {repr(e)}"}

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