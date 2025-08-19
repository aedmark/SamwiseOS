# gem/core/commands/planner.py
import json
import os
from filesystem import fs_manager

# Define user and system paths
USER_PLANS_DIR_TEMPLATE = "/home/{username}/.plans"
SYSTEM_PROJECTS_DIR = "/etc/projects"
SCORE_PATH = "/var/log/scores.json"
AGENDA_PATH = "/etc/agenda.json"

def define_flags():
    """Declares the flags that this command accepts."""
    return {
        'flags': [],
        'metadata': {}
    }

def _get_project_path(project_name, user_context):
    """Constructs the full path for a given project name based on user context."""
    username = user_context.get('name')
    is_root = username == 'root'
    if not is_root and os.path.isabs(project_name):
        return project_name
    if is_root:
        if project_name.startswith('/home/'):
            return project_name if project_name.endswith('.planner') else f"{project_name}.planner"
        return os.path.join(SYSTEM_PROJECTS_DIR, f"{project_name}.json")
    user_plans_dir = USER_PLANS_DIR_TEMPLATE.format(username=username)
    return os.path.join(user_plans_dir, f"{project_name}.planner")

def _read_json_file(path, default='{}'):
    """Reads and parses a generic JSON file."""
    node = fs_manager.get_node(path)
    if not node: return None, f"File '{path}' not found."
    if node.get('type') != 'file': return None, f"'{path}' is not a valid file."
    try:
        return json.loads(node.get('content', default)), None
    except json.JSONDecodeError:
        return None, f"Could not parse file '{path}'."

def _write_json_file(path, data, user_context):
    """Writes data back to a generic JSON file."""
    try:
        parent_dir = os.path.dirname(path)
        if not fs_manager.get_node(parent_dir):
            fs_manager.create_directory(parent_dir, user_context)
        content = json.dumps(data, indent=2)
        fs_manager.write_file(path, content, user_context)
        return True, None
    except Exception as e:
        return False, str(e)


def run(args, flags, user_context, **kwargs):
    """Manages shared and personal project to-do lists."""
    if not args:
        return {"success": False, "error": "planner: missing project name or sub-command. See 'help planner'."}

    sub_command_or_project = args[0]

    if sub_command_or_project == 'create':
        # ... (create logic remains the same)
        if len(args) != 2:
            return {"success": False, "error": "Usage: planner create <project_name>"}
        project_name = args[1]
        project_path = _get_project_path(project_name, user_context)
        if fs_manager.get_node(project_path):
            return {"success": False, "error": f"planner: project '{project_name}' already exists at '{project_path}'."}
        initial_data = {"projectName": project_name, "tasks": []}
        success, error = _write_json_file(project_path, initial_data, user_context)
        if success:
            return f"Project '{project_name}' created successfully at '{project_path}'."
        return {"success": False, "error": f"planner: {error}"}


    project_name = sub_command_or_project
    project_path = _get_project_path(project_name, user_context)
    sub_command = args[1] if len(args) > 1 else 'list'

    data, error = _read_json_file(project_path)
    if error:
        return {"success": False, "error": f"planner: {error}"}

    can_modify = fs_manager.has_permission(project_path, user_context, 'write')
    mod_commands = ['add', 'assign', 'done', 'link', 'schedule']
    if sub_command in mod_commands and not can_modify:
        return {"success": False, "error": f"planner: you do not have permission to modify '{project_name}'."}

    if sub_command == 'list':
        output = [f"\n  Project Status: {data.get('projectName', project_name)} ({project_path})", f"  {'='*70}"]
        if not data.get('tasks'):
            output.append("  No tasks yet.")
        else:
            output.append("  ID   STATUS      ASSIGNEE      TASK")
            output.append(f"  {'-'*70}")
            for task in data['tasks']:
                task_id = str(task.get('id', '')).ljust(4)
                status = task.get('status', 'open').upper().ljust(9)
                assignee = (task.get('assignee') or 'none').ljust(13)
                desc = task.get('description', '')
                if task.get('linked_file'): desc += f" [file: {task['linked_file']}]"
                if task.get('scheduled'): desc += f" [agenda: {task['scheduled']}]"
                output.append(f"  {task_id} {status} {assignee} {desc}")
        output.append(f"  {'='*70}\n")
        return "\n".join(output)

    elif sub_command == 'add':
        # ... (add logic remains the same)
        if len(args) != 3: return {"success": False, "error": 'Usage: planner <project> add "<task>"'}
        description = args[2]
        new_id = (max([t.get('id', 0) for t in data['tasks']]) if data.get('tasks') else 0) + 1
        data.setdefault('tasks', []).append({"id": new_id, "description": description, "status": "open", "assignee": "none"})
        success, error = _write_json_file(project_path, data, user_context)
        return f"Added task {new_id}." if success else {"success": False, "error": f"planner: {error}"}


    elif sub_command == 'assign':
        # ... (assign logic remains the same)
        if len(args) != 4: return {"success": False, "error": "Usage: planner <project> assign <user> <task_id>"}
        user, task_id_str = args[2], args[3]
        if not kwargs.get('users', {}).get(user): return {"success": False, "error": f"planner: user '{user}' does not exist."}
        try:
            task = next((t for t in data['tasks'] if t.get('id') == int(task_id_str)), None)
            if not task: return {"success": False, "error": f"planner: task ID {task_id_str} not found."}
            task.update({'assignee': user, 'status': 'assigned'})
            success, error = _write_json_file(project_path, data, user_context)
            return f"Task {task_id_str} assigned to {user}." if success else {"success": False, "error": f"planner: {error}"}
        except ValueError: return {"success": False, "error": f"planner: invalid task ID '{task_id_str}'."}


    elif sub_command == 'done':
        if len(args) != 3:
            return {"success": False, "error": "Usage: planner <project> done <task_id>"}
        try:
            task_id = int(args[2])
            task = next((t for t in data['tasks'] if t.get('id') == task_id), None)
            if not task or task['status'] == 'done':
                return {"success": False, "error": f"Task {task_id} not found or already done."}

            task['status'] = 'done'
            success, error = _write_json_file(project_path, data, user_context)
            if not success:
                return {"success": False, "error": f"planner: {error}"}

            # [NEW] Scoring logic
            scores, _ = _read_json_file(SCORE_PATH, default='{}')
            if scores is None: scores = {}
            user_name = user_context.get('name')
            scores[user_name] = scores.get(user_name, 0) + 1
            _write_json_file(SCORE_PATH, scores, {"name": "root", "group": "root"})

            return {"output": f"Task {task_id} marked as done! Score +1 for {user_name}!", "effect": "beep"}
        except ValueError:
            return {"success": False, "error": f"planner: invalid task ID '{args[2]}'."}

    elif sub_command == 'link':
        if len(args) != 4:
            return {"success": False, "error": "Usage: planner <project> link <task_id> <file>"}
        task_id_str, file_path = args[2], args[3]
        if not fs_manager.get_node(file_path):
            return {"success": False, "error": f"planner: file not found '{file_path}'"}
        try:
            task = next((t for t in data['tasks'] if t.get('id') == int(task_id_str)), None)
            if not task: return {"success": False, "error": f"planner: task ID {task_id_str} not found."}
            task['linked_file'] = file_path
            success, error = _write_json_file(project_path, data, user_context)
            return f"Task {task_id_str} linked to file {file_path}." if success else {"success": False, "error": f"planner: {error}"}
        except ValueError: return {"success": False, "error": f"planner: invalid task ID '{task_id_str}'."}

    elif sub_command == 'schedule':
        if len(args) != 4:
            return {"success": False, "error": 'Usage: planner <project> schedule <task_id> "<cron_string>"'}
        task_id_str, cron_string = args[2], args[3]
        try:
            task = next((t for t in data['tasks'] if t.get('id') == int(task_id_str)), None)
            if not task: return {"success": False, "error": f"planner: task ID {task_id_str} not found."}

            agenda_data, _ = _read_json_file(AGENDA_PATH, default='[]')
            if agenda_data is None: agenda_data = []
            agenda_id = (max([j.get('id', 0) for j in agenda_data]) if agenda_data else 0) + 1
            command = f'bulletin post "PLANNER REMINDER ({project_name}): Task #{task_id_str} - {task["description"]}"'
            agenda_data.append({"id": agenda_id, "cronString": cron_string, "command": command})

            success, error = _write_json_file(AGENDA_PATH, agenda_data, {"name": "root", "group": "root"})
            if not success: return {"success": False, "error": f"planner: could not write to agenda: {error}"}

            task['scheduled'] = cron_string
            success, error = _write_json_file(project_path, data, user_context)
            return f"Task {task_id_str} scheduled on agenda." if success else {"success": False, "error": f"planner: {error}"}
        except ValueError: return {"success": False, "error": f"planner: invalid task ID '{task_id_str}'."}

    else:
        return {"success": False, "error": f"planner: unknown sub-command '{sub_command}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    planner - Manages shared and personal project to-do lists.

SYNOPSIS
    planner <project> [sub-command] [options]

DESCRIPTION
    Manages project plans. By default, it operates on .planner files in the
    user's ~/.plans/ directory. When run with sudo, it manages system-wide
    projects in /etc/projects/.

SUB-COMMANDS:
  create <name>               - Creates a new project plan.
  (no sub-command) or list    - Displays the status board for <project>.
  add "<task>"                - Adds a new task to the plan.
  assign <user> <id>          - Assigns a task ID to a user.
  done <id>                   - Marks a task ID as complete and grants +1 score.
  link <id> <file>            - Links a task ID to a file path.
  schedule <id> "<cron>"      - Schedules a bulletin reminder for a task.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the planner command."""
    return "Usage: planner <project> [sub-command] [options]"