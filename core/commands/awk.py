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

    # The shell might split the program string into multiple arguments.
    # We need to reconstruct it. We'll assume the last argument is the
    # file path *if* it doesn't look like part of an awk script and exists.
    program_parts = []
    file_path = None
    potential_file = args[-1] if args else None

    # Check if the last argument is likely a file.
    # A simple check: if it doesn't contain '{' or '}' and it's not a special awk keyword.
    is_potential_file = (potential_file and
                         '{' not in potential_file and
                         '}' not in potential_file and
                         potential_file.upper() not in ['BEGIN', 'END'])

    if is_potential_file and fs_manager.get_node(potential_file):
        file_path = potential_file
        program_parts = args[:-1]
    else:
        program_parts = args

    program = " ".join(program_parts)


    # This makes the command robust enough to handle shell-like inputs.
    if (program.startswith("'") and program.endswith("'")) or \
            (program.startswith('"') and program.endswith('"')):
        program = program[1:-1]

    delimiter = flags.get('field-separator')

    lines = []
    if stdin_data is not None:
        string_input = str(stdin_data or "")
        lines = string_input.splitlines()
    elif file_path:
        node = fs_manager.get_node(file_path)
        if not node:
            return {"success": False, "error": f"awk: {file_path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"awk: {file_path}: Is a directory"}
        lines = node.get('content', '').splitlines()
    # If no file and no stdin, awk should wait for input, but we'll just exit.
    # The logic handles this by `lines` being empty.

    output_lines = []

    # This is a more flexible parser for simple '/regex/ { action }' or just '{ action }'
    pattern_part = None
    action_part = None

    # Let's try to handle BEGIN and END blocks.
    # This is a simplified parser. A real awk parser is a state machine.
    begin_match = re.search(r'BEGIN\s*{(.*?)}', program)
    end_match = re.search(r'END\s*{(.*?)}', program)
    main_program = program
    if begin_match:
        main_program = main_program.replace(begin_match.group(0), '')
    if end_match:
        main_program = main_program.replace(end_match.group(0), '')
    main_program = main_program.strip()


    # Execute BEGIN block if it exists
    if begin_match:
        begin_action = begin_match.group(1).strip()
        # We only support a simple print statement in BEGIN/END for now
        print_match = re.match(r'print\s+(.*)', begin_action)
        if print_match:
            output_lines.append(print_match.group(1).strip('"\''))


    # Process the main program logic for each line
    if main_program:
        action_match_simple = re.match(r'^\s*{(.*)}\s*$', main_program)
        if action_match_simple:
            action_part = action_match_simple.group(1).strip()
        else:
            regex_action_match = re.match(r'^\s*/(.*?)/\s*{(.*)}\s*$', main_program)
            if regex_action_match:
                pattern_part = regex_action_match.group(1)
                action_part = regex_action_match.group(2).strip()
            else:
                regex_only_match = re.match(r'^\s*/(.*?)/\s*$', main_program)
                if regex_only_match:
                    pattern_part = regex_only_match.group(1)
                    action_part = 'print $0'
                else:
                    return {"success": False, "error": f"awk: syntax error in program: {main_program}"}

        # --- EXECUTION LOGIC ---
        for line_num, line in enumerate(lines, 1):
            if pattern_part:
                try:
                    if not re.search(pattern_part, line):
                        continue
                except re.error as e:
                    return {"success": False, "error": f"awk: invalid regex: {pattern_part}"}

            if action_part:
                print_match = re.match(r'print\s+(.*)', action_part)
                if print_match:
                    fields = line.split(delimiter) if delimiter else line.split()
                    field_values = [line] + fields

                    # Special variables
                    special_vars = {
                        'NR': str(line_num)
                    }

                    parts_to_print_str = print_match.group(1)
                    print_parts = re.findall(r'"[^"]*"|\S+', parts_to_print_str)

                    output_line_parts = []
                    for part in print_parts:
                        part = part.rstrip(',') # remove trailing commas
                        if part.startswith('"') and part.endswith('"'):
                            output_line_parts.append(part[1:-1])
                        elif part.startswith('$'):
                            try:
                                field_index = int(part[1:])
                                if 0 <= field_index < len(field_values):
                                    output_line_parts.append(field_values[field_index])
                            except ValueError:
                                output_line_parts.append(part)
                        elif part in special_vars:
                            output_line_parts.append(special_vars[part])
                        else:
                            output_line_parts.append(part)

                    output_lines.append(" ".join(output_line_parts))

                else:
                    return {"success": False, "error": f"awk: unsupported action in program: {action_part}"}

    # Execute END block if it exists
    if end_match:
        end_action = end_match.group(1).strip()
        print_match = re.match(r'print\s+(.*)', end_action)
        if print_match:
            output_lines.append(print_match.group(1).strip('"\''))


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