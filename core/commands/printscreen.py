# gem/core/commands/printscreen.py
import os
from datetime import datetime

def run(args, flags, user_context, **kwargs):
    """ Determines whether to capture a screenshot as a PNG or dump terminal text to a file, and returns the appropriate effect. """
    if len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "printscreen: too many arguments",
                "suggestion": "You can only provide a single filename or no arguments."
            }
        }

    if args:
        output_filename = args[0]
        return {
            "effect": "dump_screen_text",
            "path": output_filename
        }
    else:
        timestamp = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
        return {
            "effect": "capture_screenshot_png",
            "filename": f"SamwiseOS_Screenshot_{timestamp}.png"
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    printscreen - Captures the screen content as an image or text.

SYNOPSIS
    printscreen [output_file]

DESCRIPTION
    The printscreen command captures the visible content of the terminal.
    In Image Mode (default), it generates a PNG image of the terminal and
    initiates a browser download. In Text Dump Mode, if an [output_file]
    is specified, it dumps the visible text content of the terminal to
    that file.

OPTIONS
    This command takes no options.

EXAMPLES
    printscreen
    printscreen my_screen_content.txt
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: printscreen [output_file]"