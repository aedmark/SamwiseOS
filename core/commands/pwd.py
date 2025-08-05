from filesystem import fs_manager

def run(args, flags, user_context):
    """
    Prints the current working directory.
    """
    return fs_manager.current_path