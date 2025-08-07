# gem/core/commands/su.py

def run(args, flags, user_context, stdin_data=None):
    if len(args) > 2:
        return {"success": False, "error": "Usage: su [username] [password]"}

    username = args[0] if args else "root"
    password = args[1] if len(args) > 1 else None

    return {
        "effect": "su",
        "username": username,
        "password": password
    }