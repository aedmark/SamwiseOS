# gem/core/commands/removeuser.py

from users import user_manager

def run(args, flags, user_context):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "removeuser: only root can remove users."}

    if len(args) != 1:
        return {"success": False, "error": "Usage: removeuser [-r] <username>"}

    username = args[0]
    remove_home = "-r" in flags or "--remove-home" in flags

    # This effect triggers the confirmation prompt and removal flow in JS
    return {
        "effect": "removeuser",
        "username": username,
        "remove_home": remove_home
    }