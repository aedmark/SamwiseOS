# gem/core/commands/read_messages.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to read messages for a specific job.
    """
    if len(args) != 1:
        return {"success": False, "error": "Usage: read_messages <job_id>"}

    try:
        job_id = int(args[0])
    except ValueError:
        return {"success": False, "error": f"read_messages: invalid job ID: {args[0]}"}

    return {
        "effect": "read_messages",
        "job_id": job_id
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    read_messages - Reads all messages from a job's message queue.

SYNOPSIS
    read_messages <job_id>

DESCRIPTION
    Retrieves all pending string messages for the specified <job_id>.
    Once read, messages are removed from the queue. The output is a
    space-separated string of all messages.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the read_messages command."""
    return "Usage: read_messages <job_id>"