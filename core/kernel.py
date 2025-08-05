# gem/core/kernel.py

from executor import command_executor
from filesystem import fs_manager
import json

def initialize_kernel(save_function):
    """Initializes the kernel by setting up the filesystem save function."""
    fs_manager.set_save_function(save_function)

def load_fs_from_json(json_string):
    return fs_manager.load_state_from_json(json_string)

def save_fs_to_json():
    return fs_manager.save_state_to_json()

def write_file(path, content, js_context_json):
    """Exposes the filesystem's write_file method."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.write_file(path, content, js_context.get('user_context'))
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def execute_command(command_string: str, js_context_json: str) -> str:
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"))
        command_executor.set_context(js_context.get("user_context"))

        return command_executor.execute(command_string)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}"})