# gem/core/commands/diff.py

import difflib
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the diff command accepts."""
    return [
        {'name': 'unified', 'short': 'u', 'long': 'unified', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if len(args) != 2:
        return {"success": False, "error": "diff: missing operand. Usage: diff [-u] FILE1 FILE2"}

    file1_path, file2_path = args[0], args[1]
    content1, content2 = None, None

    if file1_path == '-':
        if stdin_data is None:
            return {"success": False, "error": "diff: missing stdin for -"}
        content1 = stdin_data.splitlines()
        file1_path = 'stdin'
    else:
        node1 = fs_manager.get_node(file1_path)
        if not node1:
            return {"success": False, "error": f"diff: {file1_path}: No such file or directory"}
        content1 = node1.get('content', '').splitlines()

    if file2_path == '-':
        if stdin_data is None:
            return {"success": False, "error": "diff: missing stdin for -"}
        content2 = stdin_data.splitlines()
        file2_path = 'stdin'
    else:
        node2 = fs_manager.get_node(file2_path)
        if not node2:
            return {"success": False, "error": f"diff: {file2_path}: No such file or directory"}
        content2 = node2.get('content', '').splitlines()


    is_unified = flags.get('unified', False)

    if is_unified:
        diff = difflib.unified_diff(
            content1, content2,
            fromfile=file1_path,
            tofile=file2_path,
            lineterm=''
        )
    else:
        # Standard context diff is a good default
        diff = difflib.context_diff(
            content1, content2,
            fromfile=file1_path,
            tofile=file2_path,
            lineterm=''
        )

    return "\n".join(list(diff))

def man(args, flags, user_context, **kwargs):
    return """
NAME
    diff - compare files line by line

SYNOPSIS
    diff [OPTION]... FILE1 FILE2

DESCRIPTION
    Compare files line by line.

    -u, --unified
          Output 3 lines of unified context, the most common format.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: diff [-u] <file1> <file2>"