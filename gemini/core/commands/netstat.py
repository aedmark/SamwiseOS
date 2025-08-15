# gem/core/commands/netstat.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to trigger the display of network status.
    """
    if args:
        return {"success": False, "error": "netstat: command takes no arguments"}

    return {"effect": "netstat_display"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    netstat - Shows network status and connections.

SYNOPSIS
    netstat

DESCRIPTION
    Displays a list of all discovered SamwiseOS instances and their
    connection status, including your own instance ID.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the netstat command."""
    return "Usage: netstat"