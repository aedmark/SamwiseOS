# gem/core/commands/awk.py

import re
from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not args:
        return "awk: missing program"

    program = args[0]
    file_path = args[1] if len(args) > 1 else None

    delimiter = flags.get('-F')

    lines = []
    if stdin_data is not None:
        lines = stdin_data.splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return f"awk: {file_path}: No such file or directory"
        lines = node.get('content', '').splitlines()
    else:
        return "" # Awaiting stdin

    output_lines = []

    # This is a simplified parser for '{ print $N }' or simple regex matches
    action_match = re.match(r'{\s*print\s*(\$(\d+)|(\$0))\s*}', program)
    regex_match = re.match(r'/(.*)/', program)

    for line in lines:
        fields = line.split(delimiter) if delimiter else line.split()

        # Prepend the full line as $0
        fields.insert(0, line)

        if action_match:
            # Handle '{ print $N }'
            field_index_str = action_match.group(2)
            if field_index_str:
                field_index = int(field_index_str)
                if 0 < field_index < len(fields):
                    output_lines.append(fields[field_index])
            else: # $0
                output_lines.append(fields[0])

        elif regex_match:
            # Handle '/pattern/'
            pattern = regex_match.group(1)
            try:
                if re.search(pattern, line):
                    output_lines.append(line)
            except re.error:
                return f"awk: invalid regex: {pattern}"
        else:
            return f"awk: syntax error in program: {program}"

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    awk - pattern scanning and processing language

SYNOPSIS
    awk [ -F fs ] 'program' [file ...]

DESCRIPTION
    The awk utility executes programs written in the awk programming
    language, which is specialized for textual data manipulation.

    -F fs      Define the input field separator to be the regular
               expression fs.

    A simple program is '/regexp/' or '{ print $N }'
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: awk [-F fs] 'program' [file ...]"