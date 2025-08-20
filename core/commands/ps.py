# /core/commands/ps.py

def run(args, flags, user_context, jobs=None, **kwargs):
    if args:
        return {
            "success": False,
            "error": {
                "message": "ps: command takes no arguments",
                "suggestion": "Run 'ps' by itself to see running processes."
            }
        }

    if not jobs:
        jobs = {}

    output = ["  PID STAT TTY          TIME CMD"]
    sorted_pids = sorted(jobs.keys(), key=int)

    for pid in sorted_pids:
        job_details = jobs[pid]
        pid_str = str(pid).rjust(5)
        status = 'T' if job_details.get('status') == 'paused' else 'R'
        tty_str = "tty1".ljust(12)
        time_str = "00:00:00".rjust(8)
        cmd_str = job_details.get("command", "")

        if len(cmd_str) > 50:
            cmd_str = cmd_str[:47] + "..."

        output.append(f"{pid_str} {status.ljust(4)} {tty_str}{time_str} {cmd_str}")

    return "\\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    ps - report a snapshot of the current processes

SYNOPSIS
    ps

DESCRIPTION
    ps displays information about a selection of the active processes,
    including background jobs and their current status (e.g., Running, Stopped).

OPTIONS
    This command takes no options.

EXAMPLES
    ps
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: ps"