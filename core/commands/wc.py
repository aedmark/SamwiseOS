# gem/core/commands/wc.py

from filesystem import fs_manager

def _count_content(content):
    """Calculates lines, words, and bytes for a string."""
    lines = len(content.splitlines()) if content else 0
    words = len(content.split())
    bytes_count = len(content)
    return lines, words, bytes_count

def run(args, flags, user_context, stdin_data=None):
    show_lines = "-l" in flags
    show_words = "-w" in flags
    show_bytes = "-c" in flags

    # If no flags are specified, show all counts
    if not (show_lines or show_words or show_bytes):
        show_lines = show_words = show_bytes = True

    output_lines = []
    total_counts = {'lines': 0, 'words': 0, 'bytes': 0}

    def format_output(lines, words, bytes_count, name=""):
        parts = []
        if show_lines:
            parts.append(str(lines).rjust(7))
        if show_words:
            parts.append(str(words).rjust(7))
        if show_bytes:
            parts.append(str(bytes_count).rjust(7))
        if name:
            parts.append(f" {name}")
        return "".join(parts)

    if stdin_data is not None:
        lines, words, bytes_count = _count_content(stdin_data)
        output_lines.append(format_output(lines, words, bytes_count))
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                output_lines.append(f"wc: {path}: No such file or directory")
                continue
            if node.get('type') == 'directory':
                output_lines.append(f"wc: {path}: Is a directory")
                lines, words, bytes_count = 0, 0, 0
            else:
                content = node.get('content', '')
                lines, words, bytes_count = _count_content(content)

            output_lines.append(format_output(lines, words, bytes_count, path))
            total_counts['lines'] += lines
            total_counts['words'] += words
            total_counts['bytes'] += bytes_count

        if len(args) > 1:
            output_lines.append(format_output(total_counts['lines'], total_counts['words'], total_counts['bytes'], "total"))
    else:
        # No stdin and no args, mimics standard wc behavior
        output_lines.append(format_output(0, 0, 0))

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    wc - print newline, word, and byte counts for each file

SYNOPSIS
    wc [OPTION]... [FILE]...

DESCRIPTION
    Print newline, word, and byte counts for each FILE, and a total line if
    more than one FILE is specified. With no FILE, or when FILE is -,
    read standard input.

    -c, --bytes
          print the byte counts
    -l, --lines
          print the newline counts
    -w, --words
          print the word counts
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: wc [OPTION]... [FILE]..."