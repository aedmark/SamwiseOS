from executor import command_executor
from filesystem import fs_manager
import json

# Expose the filesystem manager's methods to be callable from JavaScript
def load_fs_from_json(json_string):
    return fs_manager.load_state_from_json(json_string)

def save_fs_to_json():
    return fs_manager.save_state_to_json()

# Main entry point for executing commands, now with context
def execute_command(command_string: str, js_context_json: str) -> str:
    """
    Sets the context and passes the command string to the Python CommandExecutor.
    """
    try:
        # Load context from JS every time
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"))
        command_executor.set_context(js_context.get("user_context"))

        return command_executor.execute(command_string)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}"})