# gem/core/commands/agenda.py

import json
from filesystem import fs_manager

AGENDA_PATH = "/etc/agenda.json"

def define_flags():
    """Declares the flags that this command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def _read_schedule():
    """Reads and parses the agenda file."""
    node = fs_manager.get_node(AGENDA_PATH)
    if not node:
        return []
    try:
        return json.loads(node.get('content', '[]'))
    except json.JSONDecodeError:
        return [] # Return empty list if corrupt

def _write_schedule(schedule, user_context):
    """Writes the schedule back to the agenda file."""
    content = json.dumps(schedule, indent=2)
    try:
        fs_manager.write_file(AGENDA_PATH, content, user_context)
        return True, None
    except Exception as e:
        return False, str(e)

def run(args, flags, user_context, **kwargs):
    """
    Manages scheduled background tasks.
    """
    if not args:
        return {"success": False, "error": "agenda: missing sub-command. Use 'add', 'list', or 'remove'."}

    sub_command = args[0].lower()

    if sub_command in ["add", "remove"] and user_context.get('name') != 'root':
        return {"success": False, "error": "agenda: modifying the schedule requires root privileges."}

    if sub_command == "add":
        if len(args) < 3:
            return {"success": False, "error": 'Usage: agenda add "<cron>" "<command>"'}
        cron_string = args[1]
        command = " ".join(args[2:])

        schedule = _read_schedule()
        new_id = (max([job.get('id', 0) for job in schedule]) if schedule else 0) + 1

        schedule.append({"id": new_id, "cronString": cron_string, "command": command})

        success, error = _write_schedule(schedule, user_context)
        if not success:
            return {"success": False, "error": f"agenda: could not write to schedule file: {error}"}

        return f"Job {new_id} added to agenda."

    elif sub_command == "list":
        schedule = _read_schedule()
        if not schedule:
            return "The agenda is currently empty."

        output = ["ID  Schedule             Command", "-------------------------------------"]
        for job in schedule:
            job_id = str(job.get('id', '')).ljust(3)
            cron = job.get('cronString', '').ljust(20)
            cmd = job.get('command', '')
            output.append(f"{job_id} {cron} {cmd}")
        return "\n".join(output)

    elif sub_command == "remove":
        if len(args) != 2:
            return {"success": False, "error": "Usage: agenda remove <id>"}
        try:
            job_id_to_remove = int(args[1])
        except ValueError:
            return {"success": False, "error": "agenda: invalid job ID."}

        schedule = _read_schedule()
        new_schedule = [job for job in schedule if job.get('id') != job_id_to_remove]

        if len(new_schedule) == len(schedule):
            return {"success": False, "error": f"agenda: job with ID {job_id_to_remove} not found."}

        success, error = _write_schedule(new_schedule, user_context)
        if not success:
            return {"success": False, "error": f"agenda: could not write to schedule file: {error}"}

        return f"Job {job_id_to_remove} removed from agenda."

    else:
        return {"success": False, "error": f"agenda: unknown sub-command '{sub_command}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    agenda - Schedules commands to run at specified times or intervals.

SYNOPSIS
    agenda <sub-command> [options]

DESCRIPTION
    Manages scheduled background tasks by modifying /etc/agenda.json.
    The AgendaDaemon process is responsible for executing these tasks.

SUB-COMMANDS:
    add "<cron>" "<cmd>"  - Schedules a new command. (Requires root)
    list                 - Lists all scheduled commands.
    remove <id>          - Removes a scheduled command by its ID. (Requires root)
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the agenda command."""
    return "Usage: agenda <add|list|remove> [options]"