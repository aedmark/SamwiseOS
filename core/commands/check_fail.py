# /core/commands/check_fail.py
import json
from executor import command_executor

def define_flags():
    """Declares the flags that the check_fail command accepts."""
    return [
        {'name': 'check-empty', 'short': 'z', 'long': 'check-empty', 'takes_value': False},
    ]

async def run(args, flags, user_context, **kwargs):
    """
    Checks if a given command string fails or produces empty output.
    """
    if not args:
        return {
            "success": False,
            "error": {
                "message": "check_fail: missing command string",
                "suggestion": "You must provide a command to test, e.g., 'check_fail \"ls /nonexistent\"'."
            }
        }

    command_to_test = " ".join(args)
    check_empty_output = flags.get('check-empty', False)

    serializable_kwargs = {}
    for key, value in kwargs.items():
        if isinstance(value, (dict, list, str, int, float, bool, type(None))):
            serializable_kwargs[key] = value

    js_context_json = json.dumps({
        "user_context": user_context,
        **serializable_kwargs
    })

    test_result_json = await command_executor.execute(command_to_test, js_context_json)
    test_result = json.loads(test_result_json)

    if check_empty_output:
        output_is_empty = not test_result.get("output") or not test_result.get("output").strip()
        if output_is_empty:
            return f"CHECK_FAIL: SUCCESS - Command <{command_to_test}> produced empty output as expected."
        else:
            return {
                "success": False,
                "error": {
                    "message": f"CHECK_FAIL: FAILURE - Command <{command_to_test}> did NOT produce empty output",
                    "suggestion": "The command was expected to have no output but did not."
                }
            }
    else:
        if test_result.get("success"):
            return {
                "success": False,
                "error": {
                    "message": f"CHECK_FAIL: FAILURE - Command <{command_to_test}> unexpectedly SUCCEEDED",
                    "suggestion": "The command was expected to fail but succeeded instead."
                }
            }
        else:
            error_msg = test_result.get('error', 'N/A')
            return f"CHECK_FAIL: SUCCESS - Command <{command_to_test}> failed as expected. (Error: {error_msg})"

def man(args, flags, user_context, **kwargs):
    return """
NAME
    check_fail - Checks command failure or empty output (for testing).

SYNOPSIS
    check_fail [-z] "<command_string>"

DESCRIPTION
    A testing utility that executes a given command string. It succeeds if the command fails. This is useful for writing automated test scripts.

OPTIONS
    -z, --check-empty
        The check succeeds if the command produces no standard output, regardless of its success or failure.

EXAMPLES
    check_fail "ls /nonexistent_directory"
    check_fail -z "ls /empty_directory"
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the check_fail command."""
    return "Usage: check_fail [-z] \"<command>\""