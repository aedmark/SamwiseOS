# gem/core/apps/top.py

def get_process_list(jobs):
    """
    Gathers and formats the list of active processes (jobs).
    The 'jobs' dictionary is passed from the CommandExecutor's context.
    """
    if not jobs:
        return []

    processes = []
    # The jobs object from JS is a PyProxy dict-like object
    for pid, job_details in jobs.items():
        processes.append({
            "pid": pid,
            "user": job_details.get('user', 'system'),
            "status": job_details.get('status', 'RUNNING')[0].upper(), # Get first letter and capitalize
            "command": job_details.get('command', '')
        })

    # Sort by PID for consistent ordering
    processes.sort(key=lambda p: int(p['pid']))
    return processes

# We don't need a full class here since the logic is stateless.
# The kernel will import and call this function directly.