from datetime import datetime

def run(*args, **kwargs) -> str:
    """
    Returns the current date and time as a string.
    """
    return str(datetime.now())