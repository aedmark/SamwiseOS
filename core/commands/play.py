# gem/core/commands/play.py

def run(args, flags, user_context, **kwargs):
    """
    Validates arguments for playing a note and returns an effect
    to be handled by the JavaScript SoundManager.
    """
    if len(args) != 2:
        return {
            "success": False,
            "error": {
                "message": "play: incorrect number of arguments",
                "suggestion": "Usage: play \"<note or chord>\" <duration>"
            }
        }

    notes_string = args[0]
    duration = args[1]

    return {
        "effect": "play_sound",
        "notes": notes_string.split(' '),
        "duration": duration
    }

def man(args, flags, user_context, **kwargs):
    return '''
NAME
    play - Plays a musical note or chord.

SYNOPSIS
    play "<note or chord>" <duration>

DESCRIPTION
    Plays a musical note or chord using the system synthesizer. Notes should be
    specified in standard notation (e.g., C4, F#5). Chords are space-separated
    notes within quotes. Duration is specified in notation like '4n' (quarter note)
    or '8n' (eighth note).

OPTIONS
    This command takes no options.

EXAMPLES
    play C4 4n
    play "A3 C4 E4" 2n
'''

def help(args, flags, user_context, **kwargs):
    return 'Usage: play "<note or chord>" <duration>'