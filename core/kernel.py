import sys
from importlib import import_module

def execute_command(command_string: str) -> str:
    """
    The main entry point for all commands from the JavaScript layer.
    """
    parts = command_string.strip().split()
    command_name = parts[0]
    args = parts[1:]

    try:
        if command_name == "date":
            date_module = import_module("commands.date")
            return date_module.run()
        else:
            return f"Python received: {command_string}"
    except Exception as e:
        return f"Python Error: {e}"