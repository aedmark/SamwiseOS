# gem/core/commands/history.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    """
    Handles the -c flag for clearing history. Other history functionality remains in JS.
    """
    if "-c" in flags:
        return {"effect": "clear_history"}

    # This command should only be called with the -c flag from the JS executor.
    # Returning an empty string is a safe fallback.
    return ""

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    history - display command history

SYNOPSIS
    history [-c]

DESCRIPTION
    Displays the command history list.

    -c     clear the history list by deleting all entries.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: history [-c]"