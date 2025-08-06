# gem/core/commands/curl.py

import urllib.request
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not args:
        return "curl: try 'curl --help' or 'curl --manual' for more information"

    url = args[0]

    # Prepend http:// if no scheme is present for urllib
    if not url.startswith(('http://', 'https://')):
        url_with_scheme = 'http://' + url
    else:
        url_with_scheme = url

    try:
        # Add a user-agent to mimic a real browser, which some sites require
        headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'}
        req = urllib.request.Request(url_with_scheme, headers=headers)

        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status >= 400:
                return f"curl: ({response.status}) {response.reason}"

            # Read the content and decode it as UTF-8, replacing characters that can't be decoded
            content_bytes = response.read()
            return content_bytes.decode('utf-8', errors='replace')

    except urllib.error.URLError as e:
        return f"curl: (6) Could not resolve host: {url}"
    except Exception as e:
        return f"curl: an unexpected error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
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

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: curl [URL]"