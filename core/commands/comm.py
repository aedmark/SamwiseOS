# gem/core/commands/comm.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the comm command accepts."""
    return [
        {'name': 'suppress-col1', 'short': '1', 'takes_value': False},
        {'name': 'suppress-col2', 'short': '2', 'takes_value': False},
        {'name': 'suppress-col3', 'short': '3', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if len(args) != 2:
        return "comm: missing operand. Usage: comm FILE1 FILE2"

    file1_path, file2_path = args

    node1 = fs_manager.get_node(file1_path)
    if not node1:
        return f"comm: {file1_path}: No such file or directory"

    node2 = fs_manager.get_node(file2_path)
    if not node2:
        return f"comm: {file2_path}: No such file or directory"

    lines1 = node1.get('content', '').splitlines()
    lines2 = node2.get('content', '').splitlines()

    suppress_col1 = flags.get('suppress-col1', False)
    suppress_col2 = flags.get('suppress-col2', False)
    suppress_col3 = flags.get('suppress-col3', False)

    # Pre-calculate prefixes for performance
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

    # Append remaining lines from either file
    while i < len(lines1):
        if not suppress_col1:
            output_lines.append(lines1[i])
        i += 1

    while j < len(lines2):
        if not suppress_col2:
            output_lines.append(f"{col2_prefix}{lines2[j]}")
        j += 1

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    comm - compare two sorted files line by line

SYNOPSIS
    comm [OPTION]... FILE1 FILE2

DESCRIPTION
    Compare sorted files FILE1 and FILE2 line by line.

    With no options, produce three-column output.  Column one contains
    lines unique to FILE1, column two contains lines unique to FILE2,
    and column three contains lines common to both files.

    -1     suppress column 1 (lines unique to FILE1)
    -2     suppress column 2 (lines unique to FILE2)
    -3     suppress column 3 (lines that appear in both files)
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: comm [OPTION]... FILE1 FILE2"