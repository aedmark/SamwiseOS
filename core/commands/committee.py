# gem/core/commands/committee.py

import json
import os
from filesystem import fs_manager
from groups import group_manager
from users import user_manager

def define_flags():
    """Declares the flags that the committee command accepts."""
    return {
        'flags': [
            {'name': 'create', 'short': 'c', 'long': 'create', 'takes_value': True},
            {'name': 'members', 'short': 'm', 'long': 'members', 'takes_value': True},
        ],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context, **kwargs):
    """
    Automates the creation of a collaborative project space, including a user group,
    a shared directory, and a project planner.
    """
    committee_name = flags.get("create")
    members_str = flags.get("members")

    if not committee_name or not members_str:
        return {"success": False, "error": "committee: --create and --members flags are required."}

    members = [m.strip() for m in members_str.split(',')]
    project_path = f"/home/project_{committee_name}"
    # [NEW] Define the path for the new planner file
    planner_path = os.path.join(project_path, f"{committee_name}.planner")


    for member in members:
        if not user_manager.user_exists(member):
            return {"success": False, "error": f"committee: user '{member}' does not exist."}

    if group_manager.group_exists(committee_name):
        return {"success": False, "error": f"committee: group '{committee_name}' already exists."}

    if fs_manager.get_node(project_path):
        return {"success": False, "error": f"committee: directory '{project_path}' already exists."}

    try:
        # Create group and add members
        group_manager.create_group(committee_name)
        for member in members:
            group_manager.add_user_to_group(member, committee_name)

        # Create project directory and set permissions
        fs_manager.create_directory(project_path, {"name": "root", "group": "root"})
        fs_manager.chown(project_path, "root")
        fs_manager.chgrp(project_path, committee_name)
        fs_manager.chmod(project_path, "770") # rwxrwx---

        # [NEW] Create and pre-populate the planner file
        initial_plan = {
            "projectName": committee_name,
            "tasks": [
                {
                    "id": 1,
                    "description": "Define project goals and first steps.",
                    "status": "open",
                    "assignee": "none"
                }
            ]
        }
        planner_content = json.dumps(initial_plan, indent=2)
        fs_manager.write_file(planner_path, planner_content, user_context)
        # Ensure the new planner file also has the correct group permissions
        fs_manager.chgrp(planner_path, committee_name)
        fs_manager.chmod(planner_path, "660") # rw-rw----


    except Exception as e:
        # Rollback on failure
        group_manager.delete_group(committee_name)
        if fs_manager.get_node(project_path):
            fs_manager.remove(project_path, recursive=True)
        return {"success": False, "error": f"committee: an unexpected error occurred: {repr(e)}"}

    output = [
        f"Committee '{committee_name}' created successfully.",
        f"  - Group '{committee_name}' created with members: {', '.join(members)}",
        f"  - Project directory created at '{project_path}'",
        f"  - Mission planner initialized at '{planner_path}'"
    ]
    return {
        "success": True,
        "output": "\n".join(output),
        "effect": "sync_group_state",
        "groups": group_manager.get_all_groups()
    }


def man(args, flags, user_context, **kwargs):
    return """
NAME
    committee - Creates and manages a collaborative project space.

SYNOPSIS
    committee --create <name> --members <user1>,<user2>...

DESCRIPTION
    Automates the creation of a user group, a shared project directory,
    and the assignment of appropriate permissions for collaborative work.
    It also automatically creates a project planner file inside the new directory.
    This command can only be run by the root user.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the committee command."""
    return "Usage: committee --create <name> --members <user1>,<user2>..."