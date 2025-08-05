# gem/core/commands/uniq.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None):
    lines = []
    if stdin_data is not None:
        lines.extend(stdin_data.splitlines())
    elif args:
        for path in args:
            node = fs_manager.get_node(path)
            if not node:
                return f"uniq: {path}: No such file or directory"
            if node.get('type') != 'file':
                return f"uniq: {path}: Is a directory"
            lines.extend(node.get('content', '').splitlines())
    else:
        return ""

    if not lines:
        return ""

    is_count = "-c" in flags
    is_repeated = "-d" in flags
    is_unique = "-u" in flags

    if is_repeated and is_unique:
        return "uniq: printing only unique and repeated lines is mutually exclusive"

    output_lines = []
    if len(lines) > 0:
        last_line = lines[0]
        count = 1
        for i in range(1, len(lines)):
            if lines[i] == last_line:
                count += 1
            else:
                if (is_repeated and count > 1) or \
                        (is_unique and count == 1) or \
                        (not is_repeated and not is_unique):
                    if is_count:
                        output_lines.append(f"{str(count).rjust(7)} {last_line}")
                    else:
                        output_lines.append(last_line)
                last_line = lines[i]
                count = 1

        # Process the last line/group
        if (is_repeated and count > 1) or \
                (is_unique and count == 1) or \
                (not is_repeated and not is_unique):
            if is_count:
                output_lines.append(f"{str(count).rjust(7)} {last_line}")
            else:
                output_lines.append(last_line)

    return "\n".join(output_lines)

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

def help(args, flags, user_context, stdin_data=None):
    return "Usage: uniq [OPTION]... [FILE]..."