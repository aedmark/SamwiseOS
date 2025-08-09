# gem/core/commands/uptime.py

from datetime import datetime, timezone

def _format_timedelta(td):
    """Formats a timedelta object into a human-readable string."""
    days = td.days
    hours, rem = divmod(td.seconds, 3600)
    minutes, seconds = divmod(rem, 60)

    parts = []
    if days > 0:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0:
        parts.append(f"{minutes} min{'s' if minutes != 1 else ''}")
    if not parts and seconds >= 0: # show seconds if uptime is less than a minute
        parts.append(f"{seconds} sec{'s' if seconds != 1 else ''}")

    return ", ".join(parts)


def run(args, flags, user_context, session_start_time=None, **kwargs):
    """
    Shows how long the system has been running.
    """
    if not session_start_time:
        return "uptime: session start time not available."

    try:
        # Parse the ISO format string from JavaScript
        start_time = datetime.fromisoformat(session_start_time.replace('Z', '+00:00'))

        # Get the current time in UTC
        now_utc = datetime.now(timezone.utc)

        # Calculate the difference
        uptime_delta = now_utc - start_time

        current_time_str = now_utc.strftime('%H:%M:%S')
        uptime_str = _format_timedelta(uptime_delta)

        # Mimic standard uptime output
        return f" {current_time_str} up {uptime_str},  1 user"

    except (ValueError, TypeError) as e:
        return f"uptime: could not parse session start time: {repr(e)}"


def man(args, flags, user_context, **kwargs):
    return """
NAME
    uptime - Tell how long the system has been running.

SYNOPSIS
    uptime

DESCRIPTION
    Print the current time, how long the system has been running,
    and the number of users currently logged on.
"""