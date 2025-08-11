# gem/core/commands/removeuser.py

from users import user_manager

def define_flags():
    """Declares the flags that the removeuser command accepts."""
    return [
        {'name': 'remove-home', 'short': 'r', 'long': 'remove-home', 'takes_value': False},
    ]

def run(args, flags, user_context, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "removeuser: only root can remove users."}

    if not args:
        return {"success": False, "error": "Usage: removeuser [-r] <username>"}

    username = args[0]
    remove_home = flags.get('remove-home', False)

    # This effect triggers the confirmation prompt and removal flow in JS
    return {
        "effect": "removeuser",
        "username": username,
        "remove_home": remove_home
    }