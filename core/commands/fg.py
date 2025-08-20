# gem/core/commands/fg.py

def run(args, flags, user_context, jobs=None, **kwargs):
    """
    Signals the front end to bring a job to the foreground.
    """
    if len(args) > 1:
        return {
            "success": False,
            "error": {
                "message": "fg: too many arguments",
                "suggestion": "You can only bring one job to the foreground at a time."
            }
        }
    job_id_str = args[0] if args else None

    if job_id_str:
        if not job_id_str.startswith('%'):
            return {
                "success": False,
                "error": {
                    "message": f"fg: job not found: {job_id_str}",
                    "suggestion": "Job specifications must start with a '%' character (e.g., '%1')."
                }
            }
        try:
            job_id = int(job_id_str[1:])
        except ValueError:
            return {
                "success": False,
                "error": {
                    "message": f"fg: invalid job ID: {job_id_str[1:]}",
                    "suggestion": "The job ID must be a number."
                }
            }
    else:
        if not jobs:
            return {"success": False, "error": {"message": "fg: no current jobs", "suggestion": "Run 'jobs' to see a list of background jobs."}}
        job_id = max(map(int, jobs.keys())) if jobs else None
        if job_id is None:
            return {"success": False, "error": {"message": "fg: no current jobs", "suggestion": "There are no background jobs to bring to the foreground."}}

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
    Resumes a stopped or background job and brings it to the foreground, giving it control of the terminal. If no job_id is specified, the most recently backgrounded or stopped job is used.

OPTIONS
    This command takes no options.

EXAMPLES
    fg %1
        Bring job number 1 to the foreground.

    fg
        Bring the most recent job to the foreground.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: fg [%job_id]"