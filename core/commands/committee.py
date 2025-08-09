# gem/core/commands/committee.py

from filesystem import fs_manager
from groups import group_manager
from users import user_manager

def run(args, flags, user_context, **kwargs):
    """
    Automates the creation of a collaborative project space, including a user group,
    a shared directory, and setting appropriate permissions.
    """
    if user_context.get('name') != 'root':
        return {"success": False, "error": "committee: only root can create a committee."}

    committee_name = flags.get("-c") or flags.get("--create")
    members_str = flags.get("-m") or flags.get("--members")

    if not committee_name or not members_str:
        return {"success": False, "error": "committee: --create and --members flags are required."}

    members = [m.strip() for m in members_str.split(',')]
    project_path = f"/home/project_{committee_name}"

    # --- Pre-flight checks ---
    for member in members:
        if not user_manager.user_exists(member):
            return {"success": False, "error": f"committee: user '{member}' does not exist."}

    if group_manager.group_exists(committee_name):
        return {"success": False, "error": f"committee: group '{committee_name}' already exists."}

    if fs_manager.get_node(project_path):
        return {"success": False, "error": f"committee: directory '{project_path}' already exists."}

    # --- Execution ---
    try:
        # 1. Create the group
        group_manager.create_group(committee_name)

        # 2. Add members to the group
        for member in members:
            group_manager.add_user_to_group(member, committee_name)

        # 3. Create the project directory
        # The user context for directory creation should be root
        fs_manager.create_directory(project_path, {"name": "root", "group": "root"})

        # 4. Change group ownership and permissions of the new directory
        fs_manager.chgrp(project_path, committee_name)
        fs_manager.chmod(project_path, "0o770") # rwxrwx---

    except Exception as e:
        # Rollback on failure
        group_manager.delete_group(committee_name)
        if fs_manager.get_node(project_path):
            fs_manager.remove(project_path, recursive=True)
        return {"success": False, "error": f"committee: an unexpected error occurred: {repr(e)}"}

    output = [
        f"Committee '{committee_name}' created successfully.",
        f"  - Group '{committee_name}' created with members: {', '.join(members)}",
        f"  - Project directory created at '{project_path}'"
    ]
    return "\n".join(output)


def man(args, flags, user_context, **kwargs):
    return """
NAME
    committee - Creates and manages a collaborative project space.

SYNOPSIS
    committee --create <name> --members <user1>,<user2>...

DESCRIPTION
    Automates the creation of a user group, a shared project directory,
    and the assignment of appropriate permissions for collaborative work.
    This command can only be run by the root user.
"""