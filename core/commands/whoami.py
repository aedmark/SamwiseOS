def run(args, flags, user_context):
    """
    Prints the current effective user name from the provided context.
    """
    return user_context.get("name", "unknown")