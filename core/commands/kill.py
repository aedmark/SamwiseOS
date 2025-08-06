# gem/core/commands/kill.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    if not args:
        return "kill: usage: kill [-s sigspec] pid"

    signal = "TERM"  # Default signal
    pid_arg = args[0]

    # This is a simple parser; a full implementation would be more robust.
    if pid_arg.startswith('%'):
        try:
            job_id = int(pid_arg[1:])
            # In our system, PID and Job ID are the same for now.
            return {
                "effect": "signal_job",
                "job_id": job_id,
                "signal": signal
            }
        except (ValueError, IndexError):
            return f"kill: invalid job spec: {pid_arg}"

    try:
        pid = int(pid_arg)
        return {
            "effect": "signal_job",
            "job_id": pid, # PID is the Job ID
            "signal": signal
        }
    except ValueError:
        return f"kill: invalid pid: {pid_arg}"


def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    kill - send a signal to a process

SYNOPSIS
    kill [pid | %job]

DESCRIPTION
    The kill utility sends a signal to the specified processes or jobs.
    If no signal is specified, the TERM signal is sent.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: kill [pid | %job]"