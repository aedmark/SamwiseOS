# /core/commands/awk.py

import re
import shlex
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the awk command accepts."""
    return [
        {'name': 'field-separator', 'short': 'F', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, **kwargs):
    if not args:
        return {"success": False, "error": "awk: missing program"}

    program_arg = args[0]
    file_path = args[1] if len(args) > 1 else None

    # The executor's shlex.split keeps the program as a single argument,
    # including quotes. We need to strip them here for parsing.
    if (program_arg.startswith("'") and program_arg.endswith("'")) or \
            (program_arg.startswith('"') and program_arg.endswith('"')):
        program = program_arg[1:-1]
    else:
        program = program_arg

    delimiter = flags.get('field-separator')
    lines = []

    if stdin_data is not None:
        lines = str(stdin_data or "").splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node: return {"success": False, "error": f"awk: {file_path}: No such file or directory"}
        if node['type'] != 'file': return {"success": False, "error": f"awk: {file_path}: Is a directory"}
        lines = node.get('content', '').splitlines()

    output_lines = []
    begin_match = re.search(r'BEGIN\s*{(.*?)}', program, re.DOTALL)
    end_match = re.search(r'END\s*{(.*?)}', program, re.DOTALL)
    main_program = program
    if begin_match: main_program = main_program.replace(begin_match.group(0), '', 1)
    if end_match: main_program = main_program.replace(end_match.group(0), '', 1)
    main_program = main_program.strip()

    def execute_action_block(action_block, line_num=0, line=""):
        print_match = re.search(r'print(?:\s+(.*))?', action_block)
        if not print_match: return

        to_print_str = print_match.group(1) if print_match.group(1) else '$0'

        # Using shlex.split is far more robust for parsing arguments.
        try:
            print_parts = shlex.split(to_print_str)
        except ValueError:
            print_parts = to_print_str.split() # Fallback for simple cases

        if not print_parts:
            print_parts = ['$0']

        fields = line.split(delimiter) if delimiter else line.split()
        field_values = [line] + fields
        special_vars = {'NR': str(line_num)}

        output_line_parts = []
        for part in print_parts:
            if part.startswith('$'):
                try:
                    field_index = int(part[1:])
                    if 0 <= field_index < len(field_values):
                        output_line_parts.append(field_values[field_index])
                except (ValueError, IndexError):
                    pass
            elif part in special_vars:
                output_line_parts.append(special_vars[part])
            else:
                output_line_parts.append(part)
        output_lines.append(" ".join(output_line_parts))


    if begin_match:
        execute_action_block(begin_match.group(1).strip())

    if main_program:
        action_match_simple = re.match(r'^\s*{(.*)}\s*$', main_program, re.DOTALL)
        if action_match_simple:
            pattern_part = None
            action_part = action_match_simple.group(1).strip()
        else:
            regex_action_match = re.match(r'^\s*/(.*?)/\s*{(.*)}\s*$', main_program, re.DOTALL)
            if regex_action_match:
                pattern_part = regex_action_match.group(1)
                action_part = regex_action_match.group(2).strip()
            else:
                regex_only_match = re.match(r'^\s*/(.*?)/\s*$', main_program, re.DOTALL)
                if regex_only_match:
                    pattern_part = regex_only_match.group(1)
                    action_part = 'print $0'
                else:
                    return {"success": False, "error": f"awk: syntax error in program: {main_program}"}

        for line_num, line in enumerate(lines, 1):
            if pattern_part:
                try:
                    if not re.search(pattern_part, line):
                        continue
                except re.error as e:
                    return {"success": False, "error": f"awk: invalid regex: {e}"}

            execute_action_block(action_part, line_num, line)

    if end_match:
        execute_action_block(end_match.group(1).strip())

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