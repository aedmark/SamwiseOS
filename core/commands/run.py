# gem/core/commands/run.py

from filesystem import fs_manager
from executor import command_executor
import json

def run(args, flags, user_context, **kwargs):
    """
    Reads a script file and passes its lines to the executor to be run.
    """
    if not args:
        return {"success": False, "error": "run: missing file operand"}

    script_path = args[0]
    script_args = args[1:]

    # Validate the path for existence and read/execute permissions
    validation_result = fs_manager.validate_path(
        script_path,
        user_context,
        '{"expectedType": "file", "permissions": ["read", "execute"]}'
    )

    if not validation_result.get("success"):
        return {"success": False, "error": f"run: {validation_result.get('error')}"}

    script_node = validation_result.get("node")
    script_content = script_node.get('content', '')
    lines = script_content.splitlines()

    # This effect tells the JS CommandExecutor to run the script
    # It's a special case where Python initiates a script run on the JS side
    # to maintain the execution context correctly.
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
    shell environment. It is useful for automating tasks.
"""