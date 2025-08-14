# gem/core/commands/run.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "run: missing file operand"}

    script_path = args[0]
    script_args = args[1:]

    validation_result = fs_manager.validate_path(
        script_path,
        user_context,
        '{"expectedType": "file", "permissions": ["read", "execute"]}'
    )

    if not validation_result.get("success"):
        return {"success": False, "error": f"run: cannot access '{script_path}': {validation_result.get('error')}"}

    script_node = validation_result.get("node")
    script_content = script_node.get('content', '')
    lines = script_content.splitlines()

    commands_to_execute = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped_line = line.strip()

        if not stripped_line or stripped_line.startswith('#'):
            # Still append comments/blank lines so line numbers in errors are correct
            commands_to_execute.append({"command": line})
            i += 1
            continue

        password_lines_needed = 0
        if stripped_line.startswith("useradd"):
            password_lines_needed = 2
        elif stripped_line.startswith("sudo"):
            password_lines_needed = 1

        if password_lines_needed > 0:
            password_pipe = []
            # Start looking for passwords on the next line
            lookahead_index = i + 1
            # Keep track of how many lines we've consumed (including comments/blanks)
            lines_consumed = 0

            while lookahead_index < len(lines) and len(password_pipe) < password_lines_needed:
                next_line = lines[lookahead_index]
                lines_consumed += 1
                # Only add non-empty, non-comment lines to the pipe
                if next_line.strip() and not next_line.strip().startswith('#'):
                    password_pipe.append(next_line)
                lookahead_index += 1

            if len(password_pipe) == password_lines_needed:
                command_obj = {"command": line, "password_pipe": password_pipe}
                commands_to_execute.append(command_obj)
                # Advance the main counter by 1 (for the command) + however many lines we looked at
                i += 1 + lines_consumed
            else:
                # Not enough password lines found before EOF, treat as a normal command
                commands_to_execute.append({"command": line})
                i += 1
        else:
            # It's a normal command
            commands_to_execute.append({"command": line})
            i += 1

    return {
        "effect": "execute_script",
        "lines": commands_to_execute,
        "args": script_args
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    run - execute commands from a file in the current shell

SYNOPSIS
    run SCRIPT [ARGUMENTS...]

DESCRIPTION
    The run command reads and executes commands from a file in the current
    shell environment. It is useful for automating tasks. Script arguments
    can be accessed within the script using $1, $2, etc. It also supports
    non-interactive password setting for commands like 'useradd' or 'sudo'
    by placing the required password(s) on the line(s) immediately following
    the command.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the run command."""
    return "Usage: run SCRIPT [ARGUMENTS...]"