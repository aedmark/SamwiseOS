# gem/core/commands/diff.py

import difflib
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if len(args) != 2:
        return "diff: missing operand after '{}'".format(args[0] if args else 'diff')

    file1_path = args[0]
    file2_path = args[1]

    node1 = fs_manager.get_node(file1_path)
    node2 = fs_manager.get_node(file2_path)

    if not node1:
        return f"diff: {file1_path}: No such file or directory"
    if not node2:
        return f"diff: {file2_path}: No such file or directory"

    content1 = node1.get('content', '').splitlines()
    content2 = node2.get('content', '').splitlines()

    is_unified = "-u" in flags or "--unified" in flags

    if is_unified:
        diff = difflib.unified_diff(
            content1, content2,
            fromfile=file1_path,
            tofile=file2_path,
            lineterm=''
        )
    else:
        diff = difflib.context_diff(
            content1, content2,
            fromfile=file1_path,
            tofile=file2_path,
            lineterm=''
        )

    return "\\n".join(list(diff))

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    diff - compare files line by line

SYNOPSIS
    diff [OPTION]... FILE1 FILE2

DESCRIPTION
    Compare files line by line.

    -u, --unified
          Output 3 lines of unified context.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: diff [-u] <file1> <file2>"