# gem/core/commands/kill.py

def define_flags():
    """Declares the flags that the kill command accepts."""
    # NEW: We are now formally defining the '-s' flag. This lets the executor parse it.
    return [
        {'name': 'signal', 'short': 's', 'long': 'signal', 'takes_value': True},
    ]

def run(args, flags, user_context, **kwargs):
    """
    Sends a signal to a specified job or process.
    This function has been refactored to rely on the executor's parsing.
    """
    if not args:
        return {"success": False, "error": "kill: usage: kill [-s sigspec] pid | %job"}

    # Simplified logic. The signal is now in `flags`, and remaining items are in `args`.
    signal = flags.get('signal', 'TERM').upper()
    pid_args = list(args)

    # This handles the `-SIGNAL` format (e.g., -STOP) which is not a standard flag.
    if not flags.get('signal') and pid_args[0].startswith('-'):
        signal = pid_args[0][1:].upper()
        pid_args = pid_args[1:] # The rest are PIDs

    if not pid_args:
        return {"success": False, "error": "kill: missing pid"}

    # The rest of the logic remains the same, but is now more reliable.
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
    kill [-s sigspec] [pid | %job]
    kill -SIGNAME [pid | %job]

DESCRIPTION
    The kill utility sends a signal to the specified processes or jobs.
    If no signal is specified, the TERM signal is sent. Signals can be
    specified by name (e.g., -s STOP or -STOP).
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the kill command."""
    return "Usage: kill [-s sigspec | -sigspec] [pid | %job]"