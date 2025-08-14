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

        # First, skip blank lines or comments and advance the loop
        if not stripped_line or stripped_line.startswith('#'):
            i += 1
            continue

        # Next, check for commands that require non-interactive passwords
        password_lines_needed = 0
        if stripped_line.startswith("useradd"):
            password_lines_needed = 2
        elif stripped_line.startswith("sudo"):
            password_lines_needed = 1

        if password_lines_needed > 0:
            password_pipe = []
            lookahead_index = i + 1
            lines_consumed = 0

            # Look ahead to find the next N valid lines for the password
            while lookahead_index < len(lines) and len(password_pipe) < password_lines_needed:
                next_line = lines[lookahead_index]
                lines_consumed += 1 # Always consume the line we're looking at
                # Only add the line if it's not a comment or blank
                if next_line.strip() and not next_line.strip().startswith('#'):
                    password_pipe.append(next_line)
                lookahead_index += 1

            command_obj = {
                "command": line,
                "password_pipe": password_pipe if len(password_pipe) == password_lines_needed else None
            }
            commands_to_execute.append(command_obj)
            # Jump the index past the command and all the lines we just looked at
            i += 1 + lines_consumed
        else:
            # For any other normal command, just add it and move to the next line
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