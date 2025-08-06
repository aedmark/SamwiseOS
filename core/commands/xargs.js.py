# gem/core/commands/xargs.py

import shlex

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if stdin_data is None:
        return "" # No input, no action

    # The command to run is specified in args, e.g., xargs rm
    command_to_run = args if args else ['echo']

    # Split stdin into items. This is a simple implementation; a real xargs has more complex parsing.
    input_items = shlex.split(stdin_data)

    if not input_items:
        return ""

    # Construct the list of new commands to be executed by the JavaScript CommandExecutor
    new_commands = []

    # Simple implementation: one new command per input item.
    # A full implementation would handle -n, -I, etc.
    for item in input_items:
        # We need to quote the item to handle spaces and special characters safely
        quoted_item = shlex.quote(item)
        new_command_parts = command_to_run + [quoted_item]
        new_commands.append(" ".join(new_command_parts))

    return {
        "effect": "execute_commands",
        "commands": new_commands,
        "suppress_newline": True # Suppress any trailing newline from xargs itself
    }

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    xargs - build and execute command lines from standard input

SYNOPSIS
    [command] | xargs [utility [argument ...]]

DESCRIPTION
    The xargs utility reads space, tab, newline and end-of-file delimited
    strings from the standard input and executes the specified utility with
    the strings as arguments.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: [command] | xargs [utility [argument ...]]"