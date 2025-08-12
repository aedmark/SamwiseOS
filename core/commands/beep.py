# gem/core/commands/beep.py

def run(args, flags, user_context, stdin_data=None, **kwargs):
    """
    Returns a special dictionary to signal a beep effect.
    """
    if args:
        return {"success": False, "error": "beep: command takes no arguments"}

    return {"effect": "beep"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    beep - play a short system sound

SYNOPSIS
    beep

DESCRIPTION
    Plays a short, simple system tone through the emulated sound card.
    It's useful for getting auditory feedback.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the beep command."""
    return "Usage: beep"