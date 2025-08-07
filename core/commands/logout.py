# gem/core/commands/logout.py

def run(args, flags, user_context, stdin_data=None):
    if args:
        return {"success": False, "error": "logout: command takes no arguments"}

    return {"effect": "logout"}