# core/commands/pwd.py

from core.file_system_manager import FileSystemManager

def run(args, flags):
    """
    Prints the current working directory.

    Args:
        args (list): A list of arguments (not used by pwd).
        flags (list): A list of flags (not used by pwd).

    Returns:
        str: The absolute path of the current directory.
    """
    fs_manager = FileSystemManager()

    try:
        # The FileSystemManager is the single source of truth for the CWD
        return fs_manager.get_cwd()
    except Exception as e:
        return f"pwd: an unexpected error occurred: {e}"