# gem/core/commands/touch.py

from filesystem import fs_manager
from datetime import datetime, timedelta
import re

def define_flags():
    """Declares the flags that the touch command accepts."""
    return [
        {'name': 'date', 'short': 'd', 'long': 'date', 'takes_value': True},
        {'name': 'stamp', 'short': 't', 'takes_value': True},
    ]

def _parse_date_string(date_str):
    """Parses a flexible date string like '1 day ago'."""
    try:
        match = re.match(r'(\d+)\s+(day|hour|minute)s?\s+ago', date_str)
        if match:
            amount, unit = int(match.group(1)), match.group(2)
            if unit == 'day': return datetime.utcnow() - timedelta(days=amount)
            if unit == 'hour': return datetime.utcnow() - timedelta(hours=amount)
            if unit == 'minute': return datetime.utcnow() - timedelta(minutes=amount)
        # Fallback for ISO 8601 format dates
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except Exception:
        return None

def _parse_stamp(stamp_str):
    """Parses a [[CC]YY]MMDDhhmm[.ss] timestamp."""
    try:
        main_part, seconds_str = (stamp_str.split('.') + ['0'])[:2]
        seconds = int(seconds_str)

        if len(main_part) == 12: # CCYYMMDDhhmm
            year, month, day, hour, minute = int(main_part[0:4]), int(main_part[4:6]), int(main_part[6:8]), int(main_part[8:10]), int(main_part[10:12])
        elif len(main_part) == 10: # YYMMDDhhmm
            yy = int(main_part[0:2])
            year = (1900 if yy >= 69 else 2000) + yy
            month, day, hour, minute = int(main_part[2:4]), int(main_part[4:6]), int(main_part[6:8]), int(main_part[8:10])
        else:
            return None

        return datetime(year, month, day, hour, minute, seconds)
    except Exception:
        return None

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "touch: missing file operand"}

    mtime_dt = None
    if flags.get('date'):
        mtime_dt = _parse_date_string(flags['date'])
        if not mtime_dt:
            return {"success": False, "error": f"touch: invalid date format: {flags['date']}"}
    elif flags.get('stamp'):
        mtime_dt = _parse_stamp(flags['stamp'])
        if not mtime_dt:
            return {"success": False, "error": f"touch: invalid date format: {flags['stamp']}"}
    else:
        mtime_dt = datetime.utcnow()

    mtime_iso = mtime_dt.isoformat() + "Z"

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
            pass
        except Exception as e:
            return {"success": False, "error": f"touch: an unexpected error occurred with '{path}': {repr(e)}"}

    fs_manager._save_state()
    return ""

def man(args, flags, user_context, **kwargs):
    return """
NAME
    touch - change file timestamps

SYNOPSIS
    touch [-d date_string] [-t stamp] [FILE]...

DESCRIPTION
    Update the access and modification times of each FILE to the specified time,
    or the current time if no time is given. A FILE argument that does not
    exist is created empty.

    -d, --date=STRING
          parse STRING and use it instead of current time
    -t STAMP
          use [[CC]YY]MMDDhhmm[.ss] instead of current time
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: touch [OPTION]... [FILE...]"