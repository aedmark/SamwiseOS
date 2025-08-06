# gem/core/commands/wget.py

import urllib.request
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not args:
        return "wget: missing URL"

    url = args[0]
    output_path = flags.get('-O') or flags.get('--output-document')

    if not output_path:
        # If -O is not specified, derive filename from URL
        try:
            output_path = url.split('/')[-1] or "index.html"
        except IndexError:
            output_path = "index.html"

    try:
        # Add a user-agent to mimic a real browser
        headers = {'User-Agent': 'Mozilla/5.0'}
        req = urllib.request.Request(url, headers=headers)

        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return f"wget: server response: {response.status}"

            # Read the content and decode it as UTF-8, ignoring errors
            content_bytes = response.read()
            content_str = content_bytes.decode('utf-8', errors='ignore')

            # Use our core filesystem manager to write the file
            fs_manager.write_file(output_path, content_str, user_context)

        return f"'{output_path}' saved"

    except urllib.error.URLError as e:
        return f"wget: {url}: {e.reason}"
    except Exception as e:
        return f"wget: an unexpected error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
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

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: wget [-O file] [URL]"