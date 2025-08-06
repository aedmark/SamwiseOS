# gem/core/commands/reboot.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    """
    Signals the front end to perform a page reload.
    """
    return {"effect": "reboot"}

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    reboot - reboot the system

SYNOPSIS
    reboot

DESCRIPTION
    Stops all running processes and restarts the OopisOS session.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: reboot"