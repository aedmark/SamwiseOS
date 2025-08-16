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
        # Process all provided job IDs
        for job_id_str in args:
            if not job_id_str.startswith('%'):
                return {"success": False, "error": f"bg: job not found: {job_id_str}"}
            try:
                job_ids_to_resume.append(int(job_id_str[1:]))
            except ValueError:
                return {"success": False, "error": f"bg: invalid job ID: {job_id_str[1:]}"}

    effects = []
    for job_id in job_ids_to_resume:
        effects.append({
            "effect": "signal_job",
            "job_id": job_id,
            "signal": "CONT" # Continue signal
        })

    return {"effects": effects}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    bg - resume a job in the background

SYNOPSIS
    bg [%job_id]...

DESCRIPTION
    Resumes one or more stopped background jobs, keeping them in the background.
    If no job_id is specified, the most recently stopped job is used.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the bg command."""
    return "Usage: bg [%job_id]..."