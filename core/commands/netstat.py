# /core/commands/netstat.py

def run(args, flags, user_context, config=None, **kwargs):
    if not config or not config.get('NETWORKING_ENABLED'):
        return {
            "success": False,
            "error": {
                "message": "netstat: networking is disabled by the system administrator.",
                "suggestion": "To enable networking, set NETWORKING_ENABLED to true in the system configuration and reboot."
            }
        }

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
    return "Usage: netstat"