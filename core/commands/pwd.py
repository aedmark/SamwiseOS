# core/commands/pwd.py

from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Prints the current working directory.

    Args:
        args (list): A list of arguments (not used by pwd).
        flags (list): A list of flags (not used by pwd).
        user_context (dict): The context of the current user.

    Returns:
        str: The absolute path of the current directory.
    """
    try:
        # The fs_manager singleton is the single source of truth for the CWD
        return fs_manager.current_path
    except Exception as e:
        return f"pwd: an unexpected error occurred: {e}"