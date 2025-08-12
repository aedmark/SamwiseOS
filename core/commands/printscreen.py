# gem/core/commands/printscreen.py
import os
from datetime import datetime

def run(args, flags, user_context, **kwargs):
    """
    Determines whether to capture a screenshot as a PNG or dump terminal
    text to a file, and returns the appropriate effect.
    """
    if len(args) > 1:
        return {"success": False, "error": "printscreen: too many arguments"}

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
    - Image Mode (default): Generates a PNG image of the terminal and
      initiates a browser download.
    - Text Dump Mode: If an [output_file] is specified, it dumps the
      visible text content of the terminal to that file.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the printscreen command."""
    return "Usage: printscreen [output_file]"