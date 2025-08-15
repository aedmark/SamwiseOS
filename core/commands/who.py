# gem/core/commands/who.py

from datetime import datetime

def run(args, flags, user_context, session_stack=None, **kwargs):
    """
    Lists the users currently logged into the system.
    """
    if args:
        return {"success": False, "error": "who: command takes no arguments"}

    if session_stack is None:
        session_stack = [user_context.get('name', 'Guest')]

    output = []
    login_time = datetime.now().strftime('%Y-%m-%d %H:%M')

    for user in session_stack:
        output.append(f"{user.ljust(8)}   tty1         {login_time}")

    return "\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    who - show who is logged on

SYNOPSIS
    who

DESCRIPTION
    Print information about users who are currently logged in.
    This command lists all active sessions in the current stack.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the who command."""
    return "Usage: who"