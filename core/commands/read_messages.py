# gem/core/commands/read_messages.py

def run(args, flags, user_context, **kwargs):
    """ Returns an effect to read messages for a specific job. """
    if len(args) != 1:
        return {
            "success": False,
            "error": {
                "message": "read_messages: incorrect number of arguments",
                "suggestion": "Usage: read_messages <job_id>"
            }
        }

    try:
        job_id = int(args[0])
    except ValueError:
        return {
            "success": False,
            "error": {
                "message": f"read_messages: invalid job ID: {args[0]}",
                "suggestion": "The job ID must be a number."
            }
        }

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

OPTIONS
    This command takes no options.

EXAMPLES
    read_messages 1
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: read_messages <job_id>"