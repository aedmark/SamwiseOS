# gem/core/commands/comm.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the comm command accepts."""
    return {
        'flags': [
            {'name': 'suppress-col1', 'short': '1', 'takes_value': False},
            {'name': 'suppress-col2', 'short': '2', 'takes_value': False},
            {'name': 'suppress-col3', 'short': '3', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if len(args) != 2:
        return {
            "success": False,
            "error": {
                "message": "comm: missing operand",
                "suggestion": "Try 'comm FILE1 FILE2'."
            }
        }

    file1_path, file2_path = args

    node1 = fs_manager.get_node(file1_path)
    if not node1:
        return {
            "success": False,
            "error": {
                "message": f"comm: {file1_path}: No such file or directory",
                "suggestion": "Please check the path to the first file."
            }
        }

    node2 = fs_manager.get_node(file2_path)
    if not node2:
        return {
            "success": False,
            "error": {
                "message": f"comm: {file2_path}: No such file or directory",
                "suggestion": "Please check the path to the second file."
            }
        }

    lines1 = node1.get('content', '').splitlines()
    lines2 = node2.get('content', '').splitlines()

    suppress_col1 = flags.get('suppress-col1', False)
    suppress_col2 = flags.get('suppress-col2', False)
    suppress_col3 = flags.get('suppress-col3', False)

    col2_prefix = "" if suppress_col1 else "\t"
    col3_prefix = "\t\t"
    if suppress_col1 and suppress_col2:
        col3_prefix = ""
    elif suppress_col1 or suppress_col2:
        col3_prefix = "\t"

    output_lines = []
    i, j = 0, 0
    while i < len(lines1) and j < len(lines2):
        if lines1[i] < lines2[j]:
            if not suppress_col1:
                output_lines.append(lines1[i])
            i += 1
        elif lines2[j] < lines1[i]:
            if not suppress_col2:
                output_lines.append(f"{col2_prefix}{lines2[j]}")
            j += 1
        else:
            if not suppress_col3:
                output_lines.append(f"{col3_prefix}{lines1[i]}")
            i += 1
            j += 1

    while i < len(lines1):
        if not suppress_col1:
            output_lines.append(lines1[i])
        i += 1

    while j < len(lines2):
        if not suppress_col2:
            output_lines.append(f"{col2_prefix}{lines2[j]}")
        j += 1

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    comm - compare two sorted files line by line

SYNOPSIS
    comm [OPTION]... FILE1 FILE2

DESCRIPTION
    Compare sorted files FILE1 and FILE2 line by line. With no options, produce three-column output. Column one contains lines unique to FILE1, column two contains lines unique to FILE2, and column three contains lines common to both files.

OPTIONS
    -1
        Suppress column 1 (lines unique to FILE1).
    -2
        Suppress column 2 (lines unique to FILE2).
    -3
        Suppress column 3 (lines that appear in both files).

EXAMPLES
    comm file1.txt file2.txt
        Show a three-column comparison of the two files.

    comm -12 file1.txt file2.txt
        Show only the lines that appear in both files.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: comm [OPTION]... FILE1 FILE2"