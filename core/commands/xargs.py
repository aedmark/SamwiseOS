# gem/core/commands/xargs.py

import shlex

def define_flags():
    """Declares the flags that the xargs command accepts."""
    return {
        'flags': [
            {'name': 'replace-str', 'short': 'I', 'long': 'replace-str', 'takes_value': True},
        ],
        'metadata': {}
    }


def run(args, flags, user_context, stdin_data=None, **kwargs):
    if stdin_data is None:
        return ""

    command_to_run_parts = args if args else ['echo']
    replace_str = flags.get('replace-str')

    # Correctly determine how to split the input
    if replace_str:
        # With -I, process line by line, preserving spaces in each line.
        input_items = [line for line in stdin_data.splitlines() if line.strip()]
    else:
        # Without -I, split by whitespace, respecting quotes.
        try:
            input_items = shlex.split(stdin_data)
        except ValueError:
            # Fallback for simple newline-separated lists if shlex fails.
            input_items = [line for line in stdin_data.splitlines() if line.strip()]

    if not input_items:
        return ""

    new_commands = []

    if replace_str:
        for item in input_items:
            # When -I is used, we process each item to generate a new command.
            # The item is the full line from stdin.
            substituted_parts = [
                part.replace(replace_str, item) for part in command_to_run_parts
            ]
            new_commands.append(" ".join(shlex.quote(p) for p in substituted_parts))
    else:
        # When no -I, append all items as separate arguments to a single command.
        full_command_parts = command_to_run_parts + input_items
        new_commands.append(" ".join(shlex.quote(p) for p in full_command_parts))


    return {
        "effect": "execute_commands",
        "commands": new_commands
    }


def man(args, flags, user_context, **kwargs):
    return """
NAME
    xargs - build and execute command lines from standard input

SYNOPSIS
    [command] | xargs [-I replace-str] [utility [argument ...]]

DESCRIPTION
    The xargs utility reads space or newline delimited strings from standard
    input and executes the specified utility with the strings as arguments.

OPTIONS
    -I replace-str
          Replace occurrences of replace-str in the utility and arguments
          with names read from standard input. This executes the utility
          once for each input line.

EXAMPLES
    ls | xargs rm
    find . -name "*.tmp" | xargs -I {} rm {}
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: [command] | xargs [-I repl] [utility [argument ...]]"