# gem/core/commands/login.py

def run(args, flags, user_context, stdin_data=None):
    if not 1 <= len(args) <= 2:
        return {"success": False, "error": "Usage: login <username> [password]"}

    username = args[0]
    password = args[1] if len(args) > 1 else None

    # This effect will be caught by the JavaScript command executor
    # which will then call the appropriate UserManager method.
    return {
        "effect": "login",
        "username": username,
        "password": password
    }