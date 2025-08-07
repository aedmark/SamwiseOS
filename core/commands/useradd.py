# gem/core/commands/useradd.py

from users import user_manager

def run(args, flags, user_context):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "useradd: only root can add users."}

    if len(args) != 1:
        return {"success": False, "error": "Usage: useradd <username>"}

    username = args[0]

    # This effect triggers the interactive password prompt flow in the JS UserManager
    return {
        "effect": "useradd",
        "username": username
    }