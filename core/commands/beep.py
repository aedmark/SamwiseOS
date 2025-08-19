# gem/core/commands/beep.py

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Returns a special dictionary to signal a beep effect.
    """
    if args:
        return {
            "success": False,
            "error": {
                "message": "beep: command takes no arguments",
                "suggestion": "Simply run 'beep' by itself to hear a sound."
            }
        }

    return {"effect": "beep"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    beep - play a short system sound

SYNOPSIS
    beep

DESCRIPTION
    Plays a short, simple system tone through the emulated sound card. It's useful for getting auditory feedback in scripts or to signal the completion of a task.

OPTIONS
    This command takes no options.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the beep command."""
    return "Usage: beep"