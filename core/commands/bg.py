# gem/core/commands/bg.py

def run(args, flags, user_context, jobs=None, **kwargs):
    """
    Signals the front end to resume one or more stopped jobs in the background.
    """
    job_ids_to_resume = []

    if not args:
        # If no args, find the most recently stopped job
        if not jobs:
            return {"success": False, "error": "bg: no current job"}
        stopped_jobs = [int(jid) for jid, details in jobs.items() if details.get('status') == 'paused']
        if not stopped_jobs:
            return {"success": False, "error": "bg: no stopped jobs"}
        job_ids_to_resume.append(max(stopped_jobs))
    else:
        # Process all provided job IDs, allowing for both %jobid and raw pid
        for job_id_str in args:
            job_id = None
            if job_id_str.startswith('%'):
                try:
                    job_id = int(job_id_str[1:])
                except (ValueError, IndexError):
                    return {"success": False, "error": f"bg: invalid job spec: {job_id_str}"}
            else:
                try:
                    # Allow raw PIDs just like the 'kill' command
                    job_id = int(job_id_str)
                except ValueError:
                    # If it's not a number and doesn't start with %, it's invalid.
                    return {"success": False, "error": f"bg: job not found: {job_id_str}"}

            if job_id is not None:
                job_ids_to_resume.append(job_id)

    effects = []
    for job_id in job_ids_to_resume:
        effects.append({
            "effect": "signal_job",
            "job_id": job_id,
            "signal": "CONT" # Continue signal
        })

    # Return multiple effects if multiple jobs were specified
    if len(effects) == 1:
        return effects[0]
    return {"effects": effects}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    bg - resume a job in the background

SYNOPSIS
    bg [%job_id | pid]...

DESCRIPTION
    Resumes one or more stopped background jobs, keeping them in the background.
    If no job_id is specified, the most recently stopped job is used. You can
    specify jobs by their job ID (e.g., %1) or their process ID (e.g., 1).
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: bg [%job_id | pid]..."