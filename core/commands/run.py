# gem/core/commands/run.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Reads a script file and passes its lines to the executor to be run.
    Now with password piping awareness for both sudo and useradd!
    """
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
        command_obj = {"command": line}

        if not stripped_line or stripped_line.startswith('#'):
            i += 1
            commands_to_execute.append(command_obj)
            continue

        password_lines_needed = 0
        if stripped_line.startswith("useradd"):
            password_lines_needed = 2
        elif stripped_line.startswith("sudo"):
            password_lines_needed = 1

        if password_lines_needed > 0:
            password_pipe = []
            lines_to_skip = 0
            lookahead_index = i + 1
            while lookahead_index < len(lines) and len(password_pipe) < password_lines_needed:
                next_line = lines[lookahead_index].strip()
                lines_to_skip += 1
                if next_line and not next_line.startswith('#'):
                    password_pipe.append(next_line)
                lookahead_index += 1

            if len(password_pipe) == password_lines_needed:
                command_obj["password_pipe"] = password_pipe
                i += (lines_to_skip + 1)
            else:
                i += 1
        else:
            i += 1

        commands_to_execute.append(command_obj)

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