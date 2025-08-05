# gem/core/commands/grep.py

import re
import os
from filesystem import fs_manager

def _process_content(content, pattern, flags, file_path_for_display, display_file_name):
    """Processes a string of content, finds matching lines, and returns formatted output."""
    lines = content.splitlines()
    file_match_count = 0
    file_output = []

    is_invert = "-v" in flags or "--invert-match" in flags

    for i, line in enumerate(lines):
        is_match = pattern.search(line)
        effective_match = (not is_match) if is_invert else is_match

        if effective_match:
            file_match_count += 1
            if "-c" not in flags and "--count" not in flags:
                output_line = ""
                if display_file_name:
                    output_line += f"{file_path_for_display}:"
                if "-n" in flags or "--line-number" in flags:
                    output_line += f"{i + 1}:"
                output_line += line
                file_output.append(output_line)

    if "-c" in flags or "--count" in flags:
        count_output = ""
        if display_file_name:
            count_output += f"{file_path_for_display}:"
        count_output += str(file_match_count)
        return [count_output]

    return file_output

def _search_directory(directory_path, pattern, flags, user_context, output_lines):
    """Recursively searches a directory for files to process."""
    dir_node = fs_manager.get_node(directory_path)
    if not dir_node or dir_node.get('type') != 'directory':
        return

    children = sorted(dir_node.get('children', {}).keys())
    for child_name in children:
        child_path = fs_manager.get_absolute_path(os.path.join(directory_path, child_name))
        child_node = dir_node['children'][child_name]

        if child_node.get('type') == 'directory':
            _search_directory(child_path, pattern, flags, user_context, output_lines)
        elif child_node.get('type') == 'file':
            content = child_node.get('content', '')
            output_lines.extend(_process_content(content, pattern, flags, child_path, True))


def run(args, flags, user_context, stdin_data=None):
    if not args and stdin_data is None:
        return "grep: (pattern) regular expression is required"

    pattern_str = args[0]
    file_paths = args[1:]

    try:
        re_flags = re.IGNORECASE if "-i" in flags or "--ignore-case" in flags else 0
        pattern = re.compile(pattern_str, re_flags)
    except re.error as e:
        return f"grep: invalid regular expression: {e}"

    output_lines = []

    if stdin_data is not None:
        # Piped input mode
        output_lines.extend(_process_content(stdin_data, pattern, flags, "(stdin)", False))
    elif not file_paths:
        return "grep: requires file paths to search when not used with a pipe."
    else:
        # File input mode
        is_recursive = "-r" in flags or "-R" in flags or "--recursive" in flags
        display_file_names = len(file_paths) > 1 or is_recursive

        for path in file_paths:
            node = fs_manager.get_node(path)
            if not node:
                output_lines.append(f"grep: {path}: No such file or directory")
                continue

            if node.get('type') == 'directory':
                if is_recursive:
                    _search_directory(path, pattern, flags, user_context, output_lines)
                else:
                    output_lines.append(f"grep: {path}: is a directory")
            else: # It's a file
                content = node.get('content', '')
                output_lines.extend(_process_content(content, pattern, flags, path, display_file_names))

    return "\n".join(output_lines)

def man(args, flags, user_context):
    return """
NAME
    grep - print lines that match patterns

SYNOPSIS
    grep [OPTION...] PATTERNS [FILE...]

DESCRIPTION
    grep searches for PATTERNS in each FILE. A PATTERN is a regular expression.
    
    -i, --ignore-case
          Ignore case distinctions in patterns and input data.
    -v, --invert-match
          Invert the sense of matching, to select non-matching lines.
    -n, --line-number
          Prefix each line of output with the 1-based line number.
    -c, --count
          Suppress normal output; instead print a count of matching lines.
    -r, -R, --recursive
          Read all files under each directory, recursively.
"""

def help(args, flags, user_context):
    return "Usage: grep [OPTION]... PATTERN [FILE]..."