# gem/core/commands/history.py

from session import history_manager

def define_flags():
    """Declares the flags that the history command accepts."""
    return [
        {'name': 'clear', 'short': 'c', 'long': 'clear', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    """
    Handles displaying and clearing the command history.
    """
    if flags.get('clear', False):
        history_manager.clear_history()
        return "" # Successful clear has no output

    history = history_manager.get_full_history()
    if not history:
        return ""

    output = []
    for i, cmd in enumerate(history):
        output.append(f"  {str(i + 1).rjust(4)}  {cmd}")

    return "\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    history - display command history

SYNOPSIS
    history [-c]

DESCRIPTION
    Displays the command history list with line numbers.

    -c, --clear     clear the history list by deleting all entries.
"""