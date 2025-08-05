# core/commands/echo.py

def run(args, flags):
    """
    Displays a line of text.

    Args:
        args (list): A list of strings to be printed.
        flags (list): A list of flags. We can add support for flags like '-n' later.

    Returns:
        str: The concatenated string of arguments.
    """
    try:
        # Join the arguments with spaces to form the output string
        output = " ".join(args)

        # In the future, we could handle flags like -n to suppress the newline.
        # For now, the terminal handler will add the newline.
        return output

    except Exception as e:
        return f"echo: an unexpected error occurred: {e}"