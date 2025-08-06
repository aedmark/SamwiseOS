# gem/core/commands/beep.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    """
    Returns a special dictionary to signal a beep effect.
    """
    return {"effect": "beep"}

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return """
NAME
    beep - play a short system sound

SYNOPSIS
    beep

DESCRIPTION
    Plays a short, simple system tone through the emulated sound card.
    It's useful for getting auditory feedback.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    return "Usage: beep"