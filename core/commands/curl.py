# gem/core/commands/curl.py
from pyodide.http import pyfetch
from filesystem import fs_manager
import asyncio
import os

async def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "curl: try 'curl --help' or 'curl --manual' for more information"}

    url = args[0]

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        response = await pyfetch(
            url,
            method="GET",
            headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'}
        )

        if response.status >= 400:
            return {"success": False, "error": f"curl: ({response.status}) {response.status_text}"}

        content_str = await response.string()
        return content_str

    except Exception as e:
        error_message = repr(e)
        if "Failed to fetch" in error_message:
            # This is a common error message from pyfetch for connection issues
            from urllib.parse import urlparse
            hostname = urlparse(url).hostname
            return {"success": False, "error": f"curl: (6) Could not resolve host: {hostname}"}
        return {"success": False, "error": f"curl: an unexpected error occurred: {error_message}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
curl - transfer a URL

SYNOPSIS
curl [URL]

DESCRIPTION
curl is a tool to transfer data from or to a server, using one of the
supported protocols (HTTP, HTTPS). The command is designed to work
without user interaction. curl transfers data from a server and
displays it to standard output.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: curl [URL]"