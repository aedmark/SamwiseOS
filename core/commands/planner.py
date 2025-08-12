# gem/core/commands/planner.py
import json
import os
from filesystem import fs_manager

PROJECTS_DIR = "/etc/projects"

def _get_project_path(project_name):
    """Constructs the full path for a given project name."""
    return os.path.join(PROJECTS_DIR, f"{project_name}.json")

def _read_project_file(project_name):
    """Reads and parses a project file, returning data or an error string."""
    path = _get_project_path(project_name)
    node = fs_manager.get_node(path)
    if not node:
        return None, f"Project '{project_name}' not found."
    if node.get('type') != 'file':
        return None, f"'{path}' is not a valid project file."
    try:
        data = json.loads(node.get('content', '{}'))
        return data, None
    except json.JSONDecodeError:
        return None, f"Could not parse project file for '{project_name}'."

def _write_project_file(project_name, data, user_context):
    """Writes data back to a project file."""
    path = _get_project_path(project_name)
    try:
        content = json.dumps(data, indent=2)
        fs_manager.write_file(path, content, user_context)
        return True, None
    except Exception as e:
        return False, str(e)

def run(args, flags, user_context, **kwargs):
    """Manages shared project to-do lists."""
    if not args:
        return {"success": False, "error": "planner: missing project name or sub-command. See 'help planner'."}

    sub_command_or_project = args[0]
    if sub_command_or_project == 'create':
        if user_context.get('name') != 'root':
            return {"success": False, "error": "planner create: only root can create new projects."}
        if len(args) != 2:
            return {"success": False, "error": "Usage: sudo planner create <project_name>"}

        project_name = args[1]
        fs_manager.create_directory(PROJECTS_DIR, user_context) # mkdir -p

        initial_data = {"projectName": project_name, "tasks": []}
        success, error = _write_project_file(project_name, initial_data, user_context)
        if success:
            return f"Project '{project_name}' created successfully."
        return {"success": False, "error": f"planner: {error}"}

    project_name = sub_command_or_project
    sub_command = args[1] if len(args) > 1 else 'list'

    data, error = _read_project_file(project_name)
    if error:
        return {"success": False, "error": f"planner: {error}"}

    if sub_command == 'list':
        output = [f"\\n  Project Status: {data.get('projectName', project_name)}", f"  {'='*70}"]
        if not data.get('tasks'):
            output.append("  No tasks yet. Use 'planner add \"<task>\"' to add one.")
        else:
            output.append("  ID   STATUS      ASSIGNEE      TASK")
            output.append(f"  {'-'*70}")
            for task in data['tasks']:
                task_id = str(task.get('id', '')).ljust(4)
                status = task.get('status', 'open').upper().ljust(9)
                assignee = (task.get('assignee') or 'none').ljust(13)
                output.append(f"  {task_id} {status} {assignee} {task.get('description', '')}")
        output.append(f"  {'='*70}\\n")
        return "\\n".join(output)

    elif sub_command == 'add':
        if len(args) != 3:
            return {"success": False, "error": 'Usage: planner <project> add "<task>"'}
        description = args[2]
        new_id = (max([t.get('id', 0) for t in data['tasks']]) if data.get('tasks') else 0) + 1
        data.setdefault('tasks', []).append({"id": new_id, "description": description, "status": "open", "assignee": "none"})
        success, error = _write_project_file(project_name, data, user_context)
        return f"Added task {new_id} to '{project_name}'." if success else {"success": False, "error": f"planner: {error}"}

    elif sub_command == 'assign':
        if len(args) != 4:
            return {"success": False, "error": "Usage: planner <project> assign <user> <task_id>"}
        user, task_id_str = args[2], args[3]
        if not kwargs.get('users', {}).get(user):
            return {"success": False, "error": f"planner: user '{user}' does not exist."}
        try:
            task_id = int(task_id_str)
            task = next((t for t in data['tasks'] if t.get('id') == task_id), None)
            if not task:
                return {"success": False, "error": f"planner: task with ID {task_id} not found."}
            task['assignee'] = user
            task['status'] = 'assigned'
            success, error = _write_project_file(project_name, data, user_context)
            return f"Task {task_id} assigned to {user}." if success else {"success": False, "error": f"planner: {error}"}
        except ValueError:
            return {"success": False, "error": f"planner: invalid task ID '{task_id_str}'."}

    elif sub_command == 'done':
        if len(args) != 3:
            return {"success": False, "error": "Usage: planner <project> done <task_id>"}
        task_id_str = args[2]
        try:
            task_id = int(task_id_str)
            task = next((t for t in data['tasks'] if t.get('id') == task_id), None)
            if not task:
                return {"success": False, "error": f"planner: task with ID {task_id} not found."}
            task['status'] = 'done'
            success, error = _write_project_file(project_name, data, user_context)
            return f"Task {task_id} marked as done." if success else {"success": False, "error": f"planner: {error}"}
        except ValueError:
            return {"success": False, "error": f"planner: invalid task ID '{task_id_str}'."}

    else:
        return {"success": False, "error": f"planner: unknown sub-command '{sub_command}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    planner - Manages shared project to-do lists.

SYNOPSIS
    planner <project_name> [sub-command] [options]

DESCRIPTION
    Manages shared project plans stored in /etc/projects/.

SUB-COMMANDS:
  (no sub-command)     Displays the status board for <project_name>.
  create               Creates a new project plan. Usage: sudo planner create <name>
  add "<task>"         Adds a new task to the <project_name> plan.
  assign <user> <id>   Assigns a task ID to a user.
  done <id>            Marks a task ID as complete.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the planner command."""
    return "Usage: planner <project_name> [sub-command] [options]"