# gem/core/commands/ps.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    if jobs is None:
        jobs = {}

    output = ["  PID TTY          TIME CMD"]

    # Process the jobs list passed from the JavaScript context
    for pid, job_details in jobs.items():
        pid_str = str(pid).rjust(5)
        tty_str = "tty1".ljust(12) # Simulated TTY
        time_str = "00:00:00".rjust(8) # Simulated time
        cmd_str = job_details.get("command", "")

        # Truncate command for display
        if len(cmd_str) > 50:
            cmd_str = cmd_str[:47] + "..."

        output.append(f"{pid_str} {tty_str}{time_str} {cmd_str}")

    return "\n".join(output)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    ps - report a snapshot of the current processes

SYNOPSIS
    ps

DESCRIPTION
    ps displays information about a selection of the active processes.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: ps"