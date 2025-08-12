# gem/core/commands/ps.py

def run(args, flags, user_context, jobs=None, **kwargs):
    if args:
        return {"success": False, "error": "ps: command takes no arguments"}

    if not jobs:
        jobs = {}

    output = ["  PID TTY          TIME CMD"]
    for pid, job_details in jobs.items():
        pid_str = str(pid).rjust(5)
        tty_str = "tty1".ljust(12)
        time_str = "00:00:00".rjust(8)
        cmd_str = job_details.get("command", "")

        if len(cmd_str) > 50:
            cmd_str = cmd_str[:47] + "..."

        output.append(f"{pid_str} {tty_str}{time_str} {cmd_str}")

    return "\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ps - report a snapshot of the current processes

SYNOPSIS
    ps

DESCRIPTION
    ps displays information about a selection of the active processes,
    including background jobs.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the ps command."""
    return "Usage: ps"