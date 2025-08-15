# gem/core/commands/post_message.py

def run(args, flags, user_context, **kwargs):
    """
    Returns an effect to post a message to a specific job.
    """
    if len(args) != 2:
        return {"success": False, "error": "Usage: post_message <job_id> \"<message>\""}

    try:
        job_id = int(args[0])
    except ValueError:
        return {"success": False, "error": f"post_message: invalid job ID: {args[0]}"}

    message = args[1]

    return {
        "effect": "post_message",
        "job_id": job_id,
        "message": message
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    post_message - Sends a message to a background job.

SYNOPSIS
    post_message <job_id> "<message>"

DESCRIPTION
    Sends a string <message> to the specified <job_id>'s message queue
    for inter-process communication.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the post_message command."""
    return "Usage: post_message <job_id> \"<message>\""