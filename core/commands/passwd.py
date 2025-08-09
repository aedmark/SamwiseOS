# gem/core/commands/passwd.py

def run(args, flags, user_context, **kwargs):
    if len(args) > 1:
        return {"success": False, "error": "Usage: passwd [username]"}

    target_username = args[0] if args else user_context.get('name')

    # This effect triggers the interactive password change flow in the JS UserManager
    return {
        "effect": "passwd",
        "username": target_username
    }