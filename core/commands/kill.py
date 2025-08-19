# gem/core/commands/kill.py

def define_flags():
    """Declares the flags that the kill command accepts."""
    return {
        'flags': [
            {'name': 'signal', 'short': 's', 'long': 'signal', 'takes_value': True},
        ],
        'metadata': {}
    }

def run(args, flags, user_context, **kwargs):
    """
    Sends a signal to one or more specified jobs or processes.
    """
    if not args:
        return {"success": False, "error": "kill: usage: kill [-s sigspec] pid | %job ..."}

    signal = flags.get('signal', 'TERM').upper()
    pid_args = list(args)

    if not flags.get('signal') and pid_args[0].startswith('-'):
        signal = pid_args[0][1:].upper()
        pid_args = pid_args[1:]

    if not pid_args:
        return {"success": False, "error": "kill: missing pid"}

    effects = []
    for pid_arg in pid_args:
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

        effects.append({
            "effect": "signal_job",
            "job_id": job_id,
            "signal": signal
        })

    # Return multiple effects
    return {"effects": effects}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    kill - send a signal to a process or job

SYNOPSIS
    kill [-s sigspec] [pid | %job]...
    kill -SIGNAME [pid | %job]...

DESCRIPTION
    The kill utility sends a signal to the specified processes or jobs.
    If no signal is specified, the TERM signal is sent. Multiple job IDs
    or PIDs can be specified.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the kill command."""
    return "Usage: kill [-s sigspec | -sigspec] [pid | %job]..."