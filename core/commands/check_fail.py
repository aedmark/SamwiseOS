# gem/core/commands/check_fail.py
import json
from executor import command_executor

def define_flags():
    """Declares the flags that the check_fail command accepts."""
    return [
        {'name': 'check-empty', 'short': 'z', 'long': 'check-empty', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    """
    Checks if a given command string fails or produces empty output.
    """
    if not args:
        return {"success": False, "error": "check_fail: command string argument cannot be empty"}

    command_to_test = " ".join(args)
    check_empty_output = flags.get('check-empty', False)

    # We need to execute the command within the same context
    # The command_executor instance is passed in via kwargs from the kernel
    test_result_json = command_executor.execute(command_to_test)
    test_result = json.loads(test_result_json)

    if check_empty_output:
        output_is_empty = not test_result.get("output") or not test_result.get("output").strip()
        if output_is_empty:
            return f"CHECK_FAIL: SUCCESS - Command <{command_to_test}> produced empty output as expected."
        else:
            return {"success": False, "error": f"CHECK_FAIL: FAILURE - Command <{command_to_test}> did NOT produce empty output."}
    else:
        if test_result.get("success"):
            return {"success": False, "error": f"CHECK_FAIL: FAILURE - Command <{command_to_test}> unexpectedly SUCCEEDED."}
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
    A testing utility that executes a command and succeeds if the command fails,
    or, with the -z flag, if the command produces no output.
"""