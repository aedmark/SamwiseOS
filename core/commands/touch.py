# gemini/core/commands/touch.py

from filesystem import fs_manager
from datetime import datetime
from time_utils import time_utils

def define_flags():
    """Declares the flags that the touch command accepts."""
    return {
        'flags': [
            {'name': 'date', 'short': 'd', 'long': 'date', 'takes_value': True},
            {'name': 'stamp', 'short': 't', 'takes_value': True},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "touch: missing file operand",
                "suggestion": "Please specify one or more files to touch."
            }
        }

    timestamp_result = time_utils.resolve_timestamp_from_flags(flags, command_name="touch")
    if timestamp_result["error"]:
        return {"success": False, "error": {"message": f"touch: {timestamp_result['error']}", "suggestion": "Please check the format of your timestamp or date string."}}

    mtime_iso = timestamp_result["timestamp_iso"]

    for path in args:
        try:
            node = fs_manager.get_node(path)
            if node:
                node['mtime'] = mtime_iso
            else:
                fs_manager.write_file(path, '', user_context)
                new_node = fs_manager.get_node(path)
                if new_node: new_node['mtime'] = mtime_iso
        except IsADirectoryError:
            # Touching a directory should just update its timestamp without error.
            node['mtime'] = mtime_iso
        except Exception as e:
            return {"success": False, "error": f"touch: an unexpected error occurred with '{path}': {repr(e)}"}

    fs_manager._save_state()
    return ""

def man(args, flags, user_context, **kwargs):
    return """
NAME
    touch - change file timestamps

SYNOPSIS
    touch [OPTION]... FILE...

DESCRIPTION
    Update the access and modification times of each FILE to the specified time,
    or the current time if no time is given. A FILE argument that does not
    exist is created empty.

OPTIONS
    -d, --date=STRING
          Parse STRING and use it instead of current time (e.g., "1 day ago").
    -t STAMP
          Use [[CC]YY]MMDDhhmm[.ss] instead of current time.

EXAMPLES
    touch my_file.txt
    touch -d "2 hours ago" important.log
    touch -t 202508192000 my_script.sh
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: touch [OPTION]... FILE..."