# gem/core/commands/fg.py

def run(args, flags, user_context, jobs=None, **kwargs):
    """
    Signals the front end to bring a job to the foreground.
    """
    if len(args) > 1:
        return {"success": False, "error": "fg: too many arguments"}

    job_id_str = args[0] if args else None

    if job_id_str:
        if not job_id_str.startswith('%'):
            return {"success": False, "error": f"fg: job not found: {job_id_str}"}
        try:
            job_id = int(job_id_str[1:])
        except ValueError:
            return {"success": False, "error": f"fg: invalid job ID: {job_id_str[1:]}"}
    else:
        # If no job id is provided, find the most recent one (highest ID)
        if not jobs:
            return {"success": False, "error": "fg: no current jobs"}
        job_id = max(map(int, jobs.keys())) if jobs else None
        if job_id is None:
            return {"success": False, "error": "fg: no current jobs"}

    # This effect tells the JS CommandExecutor to signal the job
    return {
        "effect": "signal_job",
        "job_id": job_id,
        "signal": "CONT" # Continue signal
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    fg - resume a job in the foreground

SYNOPSIS
    fg [%job_id]

DESCRIPTION
    Resumes a stopped or background job and brings it to the foreground.
    If no job_id is specified, the most recently backgrounded job is used.
"""