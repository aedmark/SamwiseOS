# Simplified version for now.

MAN_PAGES = {
    "ls": """
NAME
       ls - Lists directory contents and file information.

SYNOPSIS
       ls [-l] [-a] [path...]

DESCRIPTION
       The ls command lists files and directories.
"""
}

def run(args, flags, user_context, stdin_data=None):
    """
    Displays the manual page for a command.
    """
    if not args:
        return "what manual page do you want?"

    cmd_name = args[0]
    return MAN_PAGES.get(cmd_name, f"No manual entry for {cmd_name}")