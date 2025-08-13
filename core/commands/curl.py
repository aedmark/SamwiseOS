# gem/core/commands/curl.py

import urllib.request
from filesystem import fs_manager
import ssl # And again here!

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "curl: try 'curl --help' or 'curl --manual' for more information"}

    url = args[0]

    if not url.startswith(('http://', 'https://')):
        url_with_scheme = 'https://' + url
    else:
        url_with_scheme = url

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'}
        req = urllib.request.Request(url_with_scheme, headers=headers)

        # Same security badge for curl!
        context = ssl._create_unverified_context()

        with urllib.request.urlopen(req, timeout=10, context=context) as response:
            if response.status >= 400:
                return {"success": False, "error": f"curl: ({response.status}) {response.reason}"}

            content_bytes = response.read()
            return content_bytes.decode('utf-8', errors='replace')

    except urllib.error.URLError as e:
        return {"success": False, "error": f"curl: (6) Could not resolve host: {url}"}
    except Exception as e:
        return {"success": False, "error": f"curl: an unexpected error occurred: {repr(e)}"}

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