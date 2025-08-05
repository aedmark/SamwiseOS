# gem/core/commands/rm.py

from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Removes files or directories.
    """
    if not args:
        raise ValueError("rm: missing operand")

    recursive = "-r" in flags or "-R" in flags
    force = "-f" in flags

    for path_arg in args:
        try:
            # The remove logic is now correctly located in the fs_manager
            fs_manager.remove(path_arg, recursive=recursive)
        except FileNotFoundError as e:
            # If --force is used, we ignore "file not found" errors
            if not force:
                raise e
        except Exception as e:
            # Re-raise other critical errors (like IsADirectoryError)
            raise e

    return "" # No output on success