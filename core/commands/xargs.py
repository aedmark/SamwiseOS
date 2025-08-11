# gem/core/commands/xargs.py

import shlex

def define_flags():
    """Declares the flags that the xargs command accepts."""
    return [
        {'name': 'replace-str', 'short': 'I', 'long': 'replace-str', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if stdin_data is None:
        return "" # No input, no action

    command_to_run_parts = args if args else ['echo']
    input_items = [line for line in stdin_data.splitlines() if line.strip()]

    if not input_items:
        return ""

    new_commands = []
    replace_str = flags.get('replace-str')

    if replace_str:
        # -I mode: one command per input item, with replacement
        for item in input_items:
            # Replace all occurrences of the replace_str in the command parts
            new_command_parts = [
                part.replace(replace_str, item) for part in command_to_run_parts
            ]
            new_commands.append(" ".join(new_command_parts))
    else:
        # Default mode: append all items to a single command
        # (Simplified: a real xargs would batch them)
        quoted_items = [shlex.quote(item) for item in input_items]
        full_command_parts = command_to_run_parts + quoted_items
        new_commands.append(" ".join(full_command_parts))

    return {
        "effect": "execute_commands",
        "commands": new_commands
    }


def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    xargs - build and execute command lines from standard input

SYNOPSIS
    [command] | xargs [-I replace-str] [utility [argument ...]]

DESCRIPTION
    The xargs utility reads space or newline delimited strings from standard
    input and executes the specified utility with the strings as arguments.

    -I replace-str
          Replace occurrences of replace-str in the utility and arguments
          with names read from standard input. This executes the utility
          once for each input line.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: [command] | xargs [-I repl] [utility [argument ...]]"