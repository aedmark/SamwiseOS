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
        # Simple relative parser
        match = re.match(r'(\d+)\s+(day|hour|minute)s?\s+ago', date_str)
        if match:
            amount, unit = int(match.group(1)), match.group(2)
            if unit == 'day':
                return datetime.utcnow() - timedelta(days=amount)
            elif unit == 'hour':
                return datetime.utcnow() - timedelta(hours=amount)
            elif unit == 'minute':
                return datetime.utcnow() - timedelta(minutes=amount)
        # Fallback to direct parsing
        return datetime.fromisoformat(date_str)
    except Exception:
        return None

def _parse_stamp(stamp_str):
    """Parses a [[CC]YY]MMDDhhmm[.ss] timestamp."""
    try:
        if '.' in stamp_str:
            main_part, seconds_str = stamp_str.split('.')
            seconds = int(seconds_str)
        else:
            main_part, seconds = stamp_str, 0

        now = datetime.utcnow()
        if len(main_part) == 12: # CCYYMMDDhhmm
            year, month, day, hour, minute = [int(main_part[i:i+2]) for i in (2, 4, 6, 8, 10)]
            year = int(main_part[0:4])
        elif len(main_part) == 10: # YYMMDDhhmm
            yy, month, day, hour, minute = [int(main_part[i:i+2]) for i in (0, 2, 4, 6, 8)]
            year = (1900 if yy >= 69 else 2000) + yy
        else:
            return None
        return datetime(year, month, day, hour, minute, seconds)
    except Exception:
        return None


def run(args, flags, user_context, stdin_data=None):
    """
    Updates the access and modification times of a file to the current time.
    If the file does not exist, it is created with empty content.
    """
    if not args:
        return help(args, flags, user_context)

    mtime_dt = None
    if flags.get('date'):
        mtime_dt = _parse_date_string(flags['date'])
        if not mtime_dt:
            return f"touch: invalid date format: {flags['date']}"
    elif flags.get('stamp'):
        mtime_dt = _parse_stamp(flags['stamp'])
        if not mtime_dt:
            return f"touch: invalid date format: {flags['stamp']}"
    else:
        mtime_dt = datetime.utcnow()

    mtime_iso = mtime_dt.isoformat() + "Z"

    for path in args:
        try:
            node = fs_manager.get_node(path)
            if node:
                node['mtime'] = mtime_iso
                # No need to re-write content, just update the timestamp
            else:
                fs_manager.write_file(path, '', user_context)
                # write_file sets current time, so we need to update it
                new_node = fs_manager.get_node(path)
                if new_node:
                    new_node['mtime'] = mtime_iso

        except IsADirectoryError:
            pass # `touch` on a directory should silently do nothing
        except Exception as e:
            return f"touch: an unexpected error occurred with '{path}': {repr(e)}"

    fs_manager._save_state()
    return "" # Success


def man(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for the touch command.
    """
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

def help(args, flags, user_context, stdin_data=None):
    """
    Provides help information for the touch command.
    """
    return "Usage: touch [OPTION]... [FILE...]"