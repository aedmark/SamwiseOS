# gem/core/commands/kill.py

def define_flags():
    """Declares the flags that the kill command accepts."""
    # While this version doesn't use signal flags, it's good practice
    # to declare what could be here in a future version.
    return [
        {'name': 'signal', 'short': 's', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "kill: usage: kill [-s sigspec] pid"}

    signal = "TERM"  # Default signal
    pid_arg = args[0]

    if pid_arg.startswith('%'):
        try:
            job_id = int(pid_arg[1:])
            return {
                "effect": "signal_job",
                "job_id": job_id,
                "signal": signal
            }
        except (ValueError, IndexError):
            return {"success": False, "error": f"kill: invalid job spec: {pid_arg}"}

    try:
        pid = int(pid_arg)
        return {
            "effect": "signal_job",
            "job_id": pid, # PID is the Job ID in our system
            "signal": signal
        }
    except ValueError:
        return {"success": False, "error": f"kill: invalid pid: {pid_arg}"}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    kill - send a signal to a process

SYNOPSIS
    kill [pid | %job]

DESCRIPTION
    The kill utility sends a signal to the specified processes or jobs.
    If no signal is specified, the TERM signal is sent.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: kill [pid | %job]"