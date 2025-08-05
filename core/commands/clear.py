def run(args, flags, user_context, stdin_data=None):
    """
    Returns a special dictionary to signal a clear screen effect.
    """
    return {"effect": "clear_screen"}