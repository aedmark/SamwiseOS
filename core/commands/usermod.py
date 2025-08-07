# gem/core/commands/usermod.py

from users import user_manager
from groups import group_manager

def run(args, flags, user_context):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "usermod: only root can modify users."}

    # Simplified parser for this specific command's structure
    if len(args) != 2 or '-aG' not in flags:
        return {"success": False, "error": "Usage: usermod -aG <groupname> <username>"}

    groupname = flags.get('-aG')
    username = args[0] # The JS version had a different arg order, correcting to standard Linux format

    if not user_manager.user_exists(username):
        return {"success": False, "error": f"usermod: user '{username}' does not exist."}

    if not group_manager.group_exists(groupname):
        return {"success": False, "error": f"usermod: group '{groupname}' does not exist."}

    if group_manager.add_user_to_group(username, groupname):
        return {"success": True, "output": f"Added user '{username}' to group '{groupname}'."}
    else:
        return {"success": True, "output": f"User '{username}' is already a member of '{groupname}'."}