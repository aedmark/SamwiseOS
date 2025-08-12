# gem/core/commands/jobs.py

def run(args, flags, user_context, jobs=None, **kwargs):
    """
    Lists active background jobs for the current session.
    The 'jobs' dictionary is passed from the JS CommandExecutor.
    """
    if args:
        return {"success": False, "error": "jobs: command takes no arguments"}

    if not jobs:
        return "" # No active jobs

    output_lines = []
    for job_id, job_details in jobs.items():
        status = job_details.get('status', 'running').ljust(8)
        command = job_details.get('command', '')
        output_lines.append(f"[{job_id}]  {status}  {command}")

    return "\\n".join(output_lines)


def man(args, flags, user_context, **kwargs):
    return """
NAME
    jobs - display status of jobs in the current session

SYNOPSIS
    jobs

DESCRIPTION
    Lists the background jobs that were started from the current terminal,
    along with their status and command.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the jobs command."""
    return "Usage: jobs"