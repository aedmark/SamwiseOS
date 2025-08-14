# gem/core/commands/kill.py

def define_flags():
    """Declares the flags that the kill command accepts."""
    return [
        {'name': 'signal', 'short': 's', 'long': 'signal', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "kill: usage: kill [-s sigspec | -sigspec] pid | %job"}

    signal = 'TERM'
    pid_args = list(args)

    if pid_args[0].startswith('-'):
        signal_arg = pid_args[0][1:]
        # Check for -s flag
        if signal_arg == 's':
            if len(pid_args) < 3:
                return {"success": False, "error": "kill: option requires an argument -- s"}
            signal = pid_args[1].upper()
            pid_args = pid_args[2:]
        else: # -SIGNAL format
            signal = signal_arg.upper()
            pid_args = pid_args[1:]

    if not pid_args:
        return {"success": False, "error": "kill: missing pid"}

    pid_arg = pid_args[0]
    job_id = None
    if pid_arg.startswith('%'):
        try:
            job_id = int(pid_arg[1:])
        except (ValueError, IndexError):
            return {"success": False, "error": f"kill: invalid job spec: {pid_arg}"}
    else:
        try:
            job_id = int(pid_arg)
        except ValueError:
            return {"success": False, "error": f"kill: invalid pid: {pid_arg}"}

    return {
        "effect": "signal_job",
        "job_id": job_id,
        "signal": signal
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    kill - send a signal to a process

SYNOPSIS
    kill [-s sigspec | -sigspec] [pid | %job]

DESCRIPTION
    The kill utility sends a signal to the specified processes or jobs.
    If no signal is specified, the TERM signal is sent. Signals can be
    specified by name (e.g., -STOP).
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the kill command."""
    return "Usage: kill [-s sigspec | -sigspec] [pid | %job]"