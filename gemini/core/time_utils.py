# gemini/core/time_utils.py

import re
from datetime import datetime, timedelta

class TimeUtils:
    """A utility for parsing various timestamp and date string formats."""

    def parse_date_string(self, date_str):
        """
        Parses a flexible date string (e.g., '1 day ago', ISO 8601 format)
        into a datetime object.
        """
        if not isinstance(date_str, str):
            return None

        # Try parsing relative time strings like "2 days ago"
        relative_match = re.match(r'(\d+)\s+(day|hour|minute|second)s?\s+ago', date_str, re.IGNORECASE)
        if relative_match:
            amount, unit = int(relative_match.group(1)), relative_match.group(2).lower()
            # Correctly create timedelta arguments like {'days': 2} or {'seconds': 30}
            delta_args = {f"{unit}s": amount}
            return datetime.utcnow() - timedelta(**delta_args)

        # Handle a simple integer as "seconds ago"
        if date_str.isdigit():
            return datetime.utcnow() - timedelta(seconds=int(date_str))

        # Fallback for ISO 8601 format dates
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            return None

    def parse_stamp_to_iso(self, stamp_str):
        """Parses a [[CC]YY]MMDDhhmm[.ss] timestamp and returns an ISO 8601 string."""
        try:
            main_part, seconds_str = (stamp_str.split('.') + ['0'])[:2]
            seconds = int(seconds_str)

            if len(main_part) == 12:  # CCYYMMDDhhmm
                year, month, day, hour, minute = int(main_part[0:4]), int(main_part[4:6]), int(main_part[6:8]), int(main_part[8:10]), int(main_part[10:12])
            elif len(main_part) == 10:  # YYMMDDhhmm
                yy = int(main_part[0:2])
                year = (1900 if yy >= 69 else 2000) + yy
                month, day, hour, minute = int(main_part[2:4]), int(main_part[4:6]), int(main_part[6:8]), int(main_part[8:10])
            else:
                return None

            dt_obj = datetime(year, month, day, hour, minute, seconds)
            return dt_obj.isoformat() + "Z"
        except (ValueError, IndexError):
            return None

    def resolve_timestamp_from_flags(self, flags, command_name="command"):
        """
        Resolves a timestamp from command flags, preferring 'date' over 'stamp'.
        Returns a dictionary with the ISO timestamp string or an error.
        """
        if flags.get('date') and flags.get('stamp'):
            return {"timestamp_iso": None, "error": f"{command_name}: cannot use both --date and --stamp flags simultaneously."}

        if flags.get('date'):
            dt_obj = self.parse_date_string(flags['date'])
            if not dt_obj:
                return {"timestamp_iso": None, "error": f"{command_name}: invalid date string format '{flags['date']}'"}
            return {"timestamp_iso": dt_obj.isoformat() + "Z", "error": None}

        if flags.get('stamp'):
            iso_str = self.parse_stamp_to_iso(flags['stamp'])
            if not iso_str:
                return {"timestamp_iso": None, "error": f"{command_name}: invalid stamp format '{flags['stamp']}' (expected [[CC]YY]MMDDhhmm[.ss])"}
            return {"timestamp_iso": iso_str, "error": None}

        return {"timestamp_iso": datetime.utcnow().isoformat() + "Z", "error": None}

# Create a singleton instance for the kernel to use
time_utils = TimeUtils()