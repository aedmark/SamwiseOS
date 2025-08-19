# gem/core/commands/grep.py

import re
import os
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the grep command accepts."""
    return [
        {'name': 'ignore-case', 'short': 'i', 'long': 'ignore-case', 'takes_value': False},
        {'name': 'invert-match', 'short': 'v', 'long': 'invert-match', 'takes_value': False},
        {'name': 'line-number', 'short': 'n', 'long': 'line-number', 'takes_value': False},
        {'name': 'count', 'short': 'c', 'long': 'count', 'takes_value': False},
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'recursive', 'short': 'R', 'takes_value': False},
    ]

def _process_content(content, pattern, flags, file_path_for_display, display_file_name):
    """Processes a string of content, finds matching lines, and returns formatted output."""
    if not content:
        return []
    lines = content.splitlines()
    file_match_count = 0
    file_output = []

    is_invert = flags.get('invert-match', False)
    is_count = flags.get('count', False)
    is_line_number = flags.get('line-number', False)

    for i, line in enumerate(lines):
        is_match = pattern.search(line)
        effective_match = (not is_match) if is_invert else is_match

        if effective_match:
            file_match_count += 1
            if not is_count:
                output_line = ""
                if display_file_name:
                    output_line += f"{file_path_for_display}:"
                if is_line_number:
                    output_line += f"{i + 1}:"
                output_line += line
                file_output.append(output_line)

    if is_count:
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
        return {
            "success": False,
            "error": {
                "message": "grep: missing pattern",
                "suggestion": "Try 'grep \"pattern\" <file>' or pipe some data into it."
            }
        }

    pattern_str = args[0]
    file_paths = args[1:]

    try:
        re_flags = re.IGNORECASE if flags.get('ignore-case', False) else 0
        pattern = re.compile(pattern_str, re_flags)
    except re.error as e:
        return {
            "success": False,
            "error": {
                "message": f"grep: invalid regular expression: {e}",
                "suggestion": "Check your pattern for syntax errors."
            }
        }

    output_lines = []
    has_errors = False

    if stdin_data is not None:
        output_lines.extend(_process_content(stdin_data, pattern, flags, "(stdin)", False))
    elif not file_paths:
        # This case is now handled by the initial check, but we keep it for safety.
        return {
            "success": False,
            "error": {
                "message": "grep: requires file paths when not used with a pipe",
                "suggestion": "Provide one or more file names to search."
            }
        }
    else:
        is_recursive = flags.get('recursive', False)
        display_file_names = len(file_paths) > 1 or is_recursive

        for path in file_paths:
            node = fs_manager.get_node(path)
            if not node:
                output_lines.append(f"grep: {path}: No such file or directory")
                has_errors = True
                continue

            if node.get('type') == 'directory':
                if is_recursive:
                    _search_directory(path, pattern, flags, user_context, output_lines)
                else:
                    output_lines.append(f"grep: {path}: is a directory")
                    has_errors = True
            else:
                content = node.get('content', '')
                output_lines.extend(_process_content(content, pattern, flags, path, display_file_names))

    if has_errors and not output_lines:
        return {
            "success": False,
            "error": {
                "message": "\n".join(output_lines),
                "suggestion": "Check the file paths and ensure they are correct."
            }
        }


    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return '''
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
'''

def help(args, flags, user_context, **kwargs):
    return "Usage: grep [OPTION]... PATTERN [FILE]..."