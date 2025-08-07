# gem/core/commands/history.py

from session import history_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    """
    Handles displaying and clearing the command history.
    """
    if "-c" in flags:
        # Signal the JS side to clear history via the manager
        history_manager.clear_history()
        return "Command history cleared."

    # Get history from the python manager
    history = history_manager.get_full_history()
    if not history:
        return "No commands in history."

    # The history is already a Python list of strings
    output = []
    for i, cmd in enumerate(history):
        # Pad the line number to 3 spaces for alignment
        output.append(f"  {str(i + 1).rjust(3)}  {cmd}")

    return "\n".join(output)


def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    history - display command history

SYNOPSIS
    history [-c]

DESCRIPTION
    Displays the command history list with line numbers.

    -c     clear the history list by deleting all entries.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: history [-c]"