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

        # We will handle appending to the list inside each logic block now,
        # instead of having a single append at the end. This makes the flow clearer.

        if not stripped_line or stripped_line.startswith('#'):
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
            lines_to_inspect = []
            lookahead_index = i + 1
            while lookahead_index < len(lines) and len(password_pipe) < password_lines_needed:
                next_line = lines[lookahead_index]
                lines_to_inspect.append(next_line)
                if next_line.strip() and not next_line.strip().startswith('#'):
                    password_pipe.append(next_line.strip())
                lookahead_index += 1

            if len(password_pipe) == password_lines_needed:
                command_obj = {"command": line, "password_pipe": password_pipe}
                commands_to_execute.append(command_obj)
                # Advance past the command and all the lines we inspected (passwords or not)
                i += 1 + len(lines_to_inspect)
            else:
                # Not enough password lines, treat it as a normal command
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