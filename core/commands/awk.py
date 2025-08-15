# gem/core/commands/awk.py

import re
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the awk command accepts."""
    return [
        {'name': 'field-separator', 'short': 'F', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {"success": False, "error": "awk: missing program"}

    program = args[0]

    # This makes the command robust enough to handle shell-like inputs.
    if (program.startswith("'") and program.endswith("'")) or \
            (program.startswith('"') and program.endswith('"')):
        program = program[1:-1]

    file_path = args[1] if len(args) > 1 else None

    delimiter = flags.get('field-separator')

    lines = []
    # This handles piped input.
    if stdin_data is not None:
        # This prevents errors when stdin_data is None (JsNull).
        string_input = str(stdin_data or "")
        lines = string_input.splitlines()
    # This handles file input.
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {"success": False, "error": f"awk: {file_path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"awk: {file_path}: Is a directory"}
        lines = node.get('content', '').splitlines()
    # This handles no input at all.
    else:
        return ""

    output_lines = []

    action_match = re.match(r'{\s*print\s*(\$(\d+)|(\$0))\s*}', program)
    regex_match = re.match(r'/(.*)/', program)

    for line in lines:
        fields = line.split(delimiter) if delimiter else line.split()
        fields.insert(0, line)

        if action_match:
            field_index_str = action_match.group(2)
            if field_index_str:
                field_index = int(field_index_str)
                if 0 < field_index < len(fields):
                    output_lines.append(fields[field_index])
            else: # $0
                output_lines.append(fields[0])
        elif regex_match:
            pattern = regex_match.group(1)
            try:
                if re.search(pattern, line):
                    output_lines.append(line)
            except re.error:
                return {"success": False, "error": f"awk: invalid regex: {pattern}"}
        else:
            return {"success": False, "error": f"awk: syntax error in program: {program}"}

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    return "Usage: awk [-F fs] 'program' [file ...]"