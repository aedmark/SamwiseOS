# gem/core/commands/uniq.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the uniq command accepts."""
    return [
        {'name': 'count', 'short': 'c', 'long': 'count', 'takes_value': False},
        {'name': 'repeated', 'short': 'd', 'long': 'repeated', 'takes_value': False},
        {'name': 'unique', 'short': 'u', 'long': 'unique', 'takes_value': False},
    ]

def run(args, flags, user_context, stdin_data=None):
    lines = []
    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return {"success": False, "error": f"uniq: {path}: No such file or directory"}
            if node.get('type') != 'file':
                return {"success": False, "error": f"uniq: {path}: Is a directory"}
            lines.extend(node.get('content', '').splitlines())
    else:
        return ""

    if not lines:
        return ""

    is_count = flags.get('count', False)
    is_repeated = flags.get('repeated', False)
    is_unique = flags.get('unique', False)

    if is_repeated and is_unique:
        return {"success": False, "error": "uniq: printing only unique and repeated lines is mutually exclusive"}

    output_lines = []
    if len(lines) > 0:
        last_line, count = lines[0], 1
        for i in range(1, len(lines)):
            if lines[i] == last_line:
                count += 1
            else:
                if (is_repeated and count > 1) or \
                        (is_unique and count == 1) or \
                        (not is_repeated and not is_unique):
                    output_lines.append(f"{str(count).rjust(7)} {last_line}" if is_count else last_line)
                last_line, count = lines[i], 1

        if (is_repeated and count > 1) or \
                (is_unique and count == 1) or \
                (not is_repeated and not is_unique):
            output_lines.append(f"{str(count).rjust(7)} {last_line}" if is_count else last_line)

    return "\\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    uniq - report or omit repeated lines

SYNOPSIS
    uniq [OPTION]... [FILE]...

DESCRIPTION
    Filter adjacent matching lines from input, writing to output. Note:
    'uniq' does not detect repeated lines unless they are adjacent. You
    may want to 'sort' the input first.

    -c, --count
          prefix lines by the number of occurrences
    -d, --repeated
          only print duplicate lines, one for each group
    -u, --unique
          only print lines that are not repeated
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the uniq command."""
    return "Usage: uniq [-cdu] [FILE]..."