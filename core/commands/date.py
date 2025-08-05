from datetime import datetime

def run(args, flags, user_context):
    """
    Returns the current date and time as a string.
    """
    return str(datetime.now())