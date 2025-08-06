# gem/core/commands/shuf.py

import random
import re
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    lines = []

    is_echo_mode = "-e" in flags or "--echo" in flags
    is_input_range = "-i" in flags or "--input-range" in flags

    if is_echo_mode:
        lines = list(args)
    elif is_input_range:
        if not args:
            return "shuf: missing input range with -i"
        range_str = args[0]
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

    head_count = None
    if "-n" in flags or "--head-count" in flags:
        try:
            count_str = flags.get("-n") or flags.get("--head-count")
            head_count = int(count_str)
            if head_count < 0:
                raise ValueError
        except (ValueError, TypeError):
            return "shuf: invalid line count"

    if head_count is not None:
        lines = lines[:head_count]

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