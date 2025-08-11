# gem/core/commands/shuf.py

import random
import re
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the shuf command accepts."""
    return [
        {'name': 'echo', 'short': 'e', 'long': 'echo', 'takes_value': False},
        {'name': 'input-range', 'short': 'i', 'long': 'input-range', 'takes_value': True},
        {'name': 'head-count', 'short': 'n', 'long': 'head-count', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    lines = []

    is_echo_mode = flags.get('echo', False)
    range_str = flags.get('input-range')

    if is_echo_mode:
        lines = list(args)
    elif range_str:
        match = re.match(r'(\d+)-(\d+)', range_str)
        if not match:
            return f"shuf: invalid input range: '{range_str}'"
        try:
            low, high = int(match.group(1)), int(match.group(2))
            if low > high:
                return f"shuf: invalid input range: '{range_str}'"
            lines = [str(i) for i in range(low, high + 1)]
        except ValueError:
            return f"shuf: invalid input range: '{range_str}'"
    elif stdin_data is not None:
        lines = stdin_data.splitlines()
    elif args:
        path = args[0]
        node = fs_manager.get_node(path)
        if not node:
            return f"shuf: {path}: No such file or directory"
        if node.get('type') != 'file':
            return f"shuf: {path}: Is a directory"
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
            return "shuf: invalid line count"

    return "\n".join(lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    shuf - generate random permutations

SYNOPSIS
    shuf [OPTION]... [FILE]
    shuf -e [OPTION]... [ARG]...
    shuf -i LO-HI [OPTION]...

DESCRIPTION
    Write a random permutation of the input lines to standard output.

    -e, --echo
           treat each ARG as an input line
    -i, --input-range=LO-HI
           treat each number in range LO-HI as an input line
    -n, --head-count=COUNT
           output at most COUNT lines
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: shuf [-e] [-i LO-HI] [-n COUNT] [FILE]"