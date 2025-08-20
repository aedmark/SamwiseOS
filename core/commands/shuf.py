# gem/core/commands/shuf.py

import random
import re
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the shuf command accepts."""
    return {
        'flags': [
            {'name': 'echo', 'short': 'e', 'long': 'echo', 'takes_value': False},
            {'name': 'input-range', 'short': 'i', 'long': 'input-range', 'takes_value': True},
            {'name': 'head-count', 'short': 'n', 'long': 'head-count', 'takes_value': True},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    lines = []

    is_echo_mode = flags.get('echo', False)
    range_str = flags.get('input-range')

    if is_echo_mode:
        lines = list(args)
    elif range_str:
        match = re.match(r'(\d+)-(\d+)', range_str)
        if not match:
            return {
                "success": False,
                "error": {
                    "message": f"shuf: invalid input range: '{range_str}'",
                    "suggestion": "The range must be in the format 'LO-HI'."
                }
            }
        try:
            low, high = int(match.group(1)), int(match.group(2))
            if low > high:
                return {
                    "success": False,
                    "error": {
                        "message": f"shuf: invalid input range: '{range_str}'",
                        "suggestion": "The low value in the range cannot be greater than the high value."
                    }
                }
            lines = [str(i) for i in range(low, high + 1)]
        except ValueError:
            return {
                "success": False,
                "error": {
                    "message": f"shuf: invalid input range: '{range_str}'",
                    "suggestion": "The range values must be integers."
                }
            }
    elif stdin_data is not None:
        lines = stdin_data.splitlines()
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return {
                "success": False,
                "error": {
                    "message": f"shuf: {path}: No such file or directory",
                    "suggestion": "Please check the file path."
                }
            }
        if node.get('type') != 'file':
            return {
                "success": False,
                "error": {
                    "message": f"shuf: {path}: Is a directory",
                    "suggestion": "The shuf command can only operate on files."
                }
            }
        lines = node.get('content', '').splitlines()

    random.shuffle(lines)

    head_count_str = flags.get('head-count')
    if head_count_str is not None:
        try:
            head_count = int(head_count_str)
            if head_count < 0:
                raise ValueError
            lines = lines[:head_count]
        except (ValueError, TypeError):
            return {
                "success": False,
                "error": {
                    "message": f"shuf: invalid line count: '{head_count_str}'",
                    "suggestion": "The line count must be a non-negative integer."
                }
            }

    return "\n".join(lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    shuf - generate random permutations

SYNOPSIS
    shuf [OPTION]... [FILE]
    shuf -e [OPTION]... [ARG]...
    shuf -i LO-HI [OPTION]...

DESCRIPTION
    Write a random permutation of the input lines to standard output.

OPTIONS
    -e, --echo
           treat each ARG as an input line
    -i, --input-range=LO-HI
           treat each number in range LO-HI as an input line
    -n, --head-count=COUNT
           output at most COUNT lines

EXAMPLES
    shuf my_file.txt
    ls | shuf -n 3
    shuf -i 1-10 -n 5
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: shuf [-e] [-i LO-HI] [-n COUNT] [FILE]"