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

    # This is a more flexible parser for simple '/regex/ { action }' or just '{ action }'
    pattern_part = None
    action_part = None

    # Case 1: Just an action block '{...}'
    action_match_simple = re.match(r'^\s*{(.*)}\s*$', program)
    if action_match_simple:
        action_part = action_match_simple.group(1).strip()
    else:
        # Case 2: A regex and an action '/.../ {...}'
        regex_action_match = re.match(r'^\s*/(.*?)/\s*{(.*)}\s*$', program)
        if regex_action_match:
            pattern_part = regex_action_match.group(1)
            action_part = regex_action_match.group(2).strip()
        else:
            # Case 3: Just a regex '/.../'
            regex_only_match = re.match(r'^\s*/(.*?)/\s*$', program)
            if regex_only_match:
                pattern_part = regex_only_match.group(1)
                action_part = 'print $0' # Default action for a regex match
            else:
                return {"success": False, "error": f"awk: syntax error in program: {program}"}

    # --- EXECUTION LOGIC ---
    for line_num, line in enumerate(lines):
        # Apply pattern if it exists
        if pattern_part:
            try:
                if not re.search(pattern_part, line):
                    continue # Skip to next line if pattern doesn't match
            except re.error as e:
                return {"success": False, "error": f"awk: invalid regex: {pattern_part}"}

        # If we get here, either there was no pattern or the pattern matched.
        # Now, execute the action.
        if action_part:
            # Simple action parser: handles 'print $N'
            print_match = re.match(r'print\s+(\$(\d+)|(\$0))', action_part)
            if print_match:
                fields = line.split(delimiter) if delimiter else line.split()
                # $0 is the whole line. We need to handle this before splitting for other fields.

                # Correctly handle fields. $0 is the whole line.
                field_values = [line] + fields

                field_specifier = print_match.group(1)
                if field_specifier == '$0':
                    output_lines.append(field_values[0])
                else:
                    field_index = int(print_match.group(2))
                    if 0 < field_index < len(field_values):
                        output_lines.append(field_values[field_index])
            else:
                # For this specific bug, we only need to handle the print case.
                # A more complex awk would require a full parser.
                # If the action isn't a simple print, we can treat it as an error for now.
                return {"success": False, "error": f"awk: unsupported action in program: {action_part}"}

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