# gem/core/commands/play.py

def run(args, flags, user_context, **kwargs):
    """
    Validates arguments for playing a note and returns an effect
    to be handled by the JavaScript SoundManager.
    """
    if len(args) != 2:
        return {"success": False, "error": "Usage: play \"<note or chord>\" <duration>"}

    notes_string = args[0]
    duration = args[1]

    # This is a hybrid command. The Python part validates and structures the request,
    # then returns an 'effect' for the JavaScript layer to execute, as it has
    # direct access to the browser's audio APIs (Tone.js).
    return {
        "effect": "play_sound",
        "notes": notes_string.split(' '),
        "duration": duration
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    play - Plays a musical note or chord for a specific duration.

SYNOPSIS
    play "<note or chord>" <duration>

DESCRIPTION
    Plays a musical note or chord using the system synthesizer.
    - "<note or chord>": Standard musical notation (e.g., C4, "F#5 G5", "A3 C4 E4"). For chords, enclose the notes in quotes.
    - <duration>: Note duration (e.g., 4n, 8n, 1m).
"""