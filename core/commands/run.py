# gem/core/commands/run.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Reads a script file and passes its lines to the executor to be run.
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

    return {
        "effect": "execute_script",
        "lines": lines,
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
    can be accessed within the script using $1, $2, etc.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the run command."""
    return "Usage: run SCRIPT [ARGUMENTS...]"