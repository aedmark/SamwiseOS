# gem/core/commands/history.py

from session import history_manager

def run(args, flags, user_context, **kwargs):
    """
    Handles displaying and clearing the command history.
    """
    if "-c" in flags or "--clear" in flags:
        # This will now call our Python history manager's clear method
        history_manager.clear_history()
        return "Command history cleared."

    history = history_manager.get_full_history()
    # The history from the manager is already a Python list
    if not history:
        return "No commands in history."

    output = []
    for i, cmd in enumerate(history):
        # Pad the line number for that classic, aligned look
        output.append(f"  {str(i + 1).rjust(3)}  {cmd}")

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