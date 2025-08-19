# gem/core/commands/nc.py

def define_flags():
    """Declares the flags that the nc command accepts."""
    return {
        'flags': [
            {'name': 'listen', 'long': 'listen', 'takes_value': False},
            {'name': 'exec', 'long': 'exec', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, config=None, **kwargs):
    """
    Handles network communication by returning effects to the JS layer.
    """
    if not config or not config.get('NETWORKING_ENABLED'):
        return {"success": False, "error": "nc: networking is disabled by the system administrator."}

    is_listen = flags.get('listen', False)
    is_exec = flags.get('exec', False)

    if is_listen:
        if args:
            return {"success": False, "error": "nc: listen mode takes no arguments"}
        if is_exec and user_context.get('name') != 'root':
            return {"success": False, "error": "nc: --exec requires root privileges."}
        return {
            "effect": "netcat_listen",
            "execute": is_exec
        }

    if len(args) != 2:
        return {"success": False, "error": "nc: invalid arguments. Usage: nc <targetId> \"<message>\""}

    target_id, message = args[0], args[1]
    return {
        "effect": "netcat_send",
        "targetId": target_id,
        "message": message
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    nc - netcat utility for network communication

SYNOPSIS
    nc [--listen] [--exec] | [<targetId> "<message>"]

DESCRIPTION
    A utility for network communication between SamwiseOS instances.
    It can send direct messages or set up a listener to receive them.
    --exec (with --listen) executes incoming messages as commands.
    WARNING: --exec is a security risk. Use with trusted peers only.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the nc command."""
    return "Usage: nc [--listen [--exec]] | [<targetId> \"<message>\"]"