# gem/core/commands/history.py

from session import history_manager

def define_flags():
    """Declares the flags that the history command accepts."""
    return {
        'flags': [
            {'name': 'clear', 'short': 'c', 'long': 'clear', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    """
    Handles displaying and clearing the command history.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "history: command takes no arguments",
                "suggestion": "Try 'history' or 'history -c'."
            }
        }

    if flags.get('clear', False):
        history_manager.clear_history()
        return ""

    history = history_manager.get_full_history()
    if not history:
        return ""

    output = []
    for i, cmd in enumerate(history):
        output.append(f"  {str(i + 1).rjust(4)}  {cmd}")

    return "\\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    history - display command history

SYNOPSIS
    history [-c]

DESCRIPTION
    Displays the command history list with line numbers.

OPTIONS
    -c, --clear
        Clear the history list by deleting all entries.

EXAMPLES
    history
    history -c
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: history [-c]"