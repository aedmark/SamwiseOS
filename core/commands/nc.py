# /core/commands/nc.py

def define_flags():
    return {
        'flags': [
            {'name': 'listen', 'short': 'l', 'long': 'listen', 'takes_value': False},
            {'name': 'exec', 'short': 'e', 'long': 'exec', 'takes_value': False},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, config=None, **kwargs):

    if not config or not config.get('NETWORKING_ENABLED'):
        return {
            "success": False,
            "error": {
                "message": "nc: networking is disabled by the system administrator.",
                "suggestion": "To enable networking, set NETWORKING_ENABLED to true in the system configuration and reboot."
            }
        }

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
    nc [-l] [-e] | [<targetId> "<message>"]

DESCRIPTION
    A utility for network communication between SamwiseOS instances.
    It can send direct messages or set up a listener to receive them.
    -e, --exec (with -l) executes incoming messages as commands.
    WARNING: --exec is a security risk. Use with trusted peers only.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: nc [-l [-e]] | [<targetId> \"<message>\"]"