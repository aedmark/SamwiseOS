# gem/core/commands/bg.py

def run(args, flags, user_context, jobs=None, **kwargs):
    """
    Signals the front end to resume a stopped job in the background.
    """
    if len(args) > 1:
        return {"success": False, "error": "bg: too many arguments"}

    job_id_str = args[0] if args else None

    if job_id_str:
        if not job_id_str.startswith('%'):
            return {"success": False, "error": f"bg: job not found: {job_id_str}"}
        try:
            job_id = int(job_id_str[1:])
        except ValueError:
            return {"success": False, "error": f"bg: invalid job ID: {job_id_str[1:]}"}
    else:
        # Find the most recently stopped job
        if not jobs:
            return {"success": False, "error": "bg: no current job"}

        stopped_jobs = [int(jid) for jid, details in jobs.items() if details.get('status') == 'paused']
        if not stopped_jobs:
            return {"success": False, "error": "bg: no stopped jobs"}
        job_id = max(stopped_jobs)

    # This effect tells the JS CommandExecutor to signal the job
    return {
        "effect": "signal_job",
        "job_id": job_id,
        "signal": "CONT" # Continue signal
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    bg - resume a job in the background

SYNOPSIS
    bg [%job_id]

DESCRIPTION
    Resumes a stopped background job, keeping it in the background.
    If no job_id is specified, the most recently stopped job is used.
"""