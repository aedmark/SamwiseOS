# This is a simplified version. We'll need to build a way for Python
# to access the command definitions later on.

COMMAND_DESCRIPTIONS = {
    "help": "Displays a list of commands or a command's syntax.",
    "man": "Formats and displays the manual page for a command.",
    "ls": "Lists directory contents and file information.",
    "echo": "Writes arguments to the standard output.",
    "date": "Display the current system date and time.",
    "pwd": "Prints the current working directory.",
    "whoami": "Prints the current effective user name.",
    "clear": "Clears the terminal screen of all previous output."
}

def run(args, flags):
    """
    Displays help information for commands.
    """
    if not args:
        output = ["OopisOS Help (Python Core)", "", "Available commands:"]
        for cmd, desc in sorted(COMMAND_DESCRIPTIONS.items()):
            output.append(f"  {cmd.ljust(15)} {desc}")
        output.append("\nType 'help [command]' for more details.")
        return "\n".join(output)
    else:
        cmd_name = args[0]
        if cmd_name in COMMAND_DESCRIPTIONS:
            return f"Usage: {cmd_name} [options]" # Simplified for now
        else:
            return f"help: command not found: {cmd_name}"