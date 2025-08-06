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

def get_node_json(path, js_context_json):
    """Gets a filesystem node and returns it as a JSON string."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        node = fs_manager.get_node(path)
        return json.dumps({"success": True, "node": node})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def check_permission(path, js_context_json, permission_type):
    """Checks if a user has a specific permission for a node."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        has_perm = fs_manager.has_permission(path, js_context.get("user_context"), permission_type)
        return json.dumps({"success": True, "has_permission": has_perm})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def get_node_size(path):
    """Calculates the size of a node (recursively for directories)."""
    try:
        size = fs_manager.calculate_node_size(path)
        return json.dumps({"success": True, "size": size})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def validate_path_json(path, js_context_json, options_json):
    """Validates a path against a set of rules."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        result = fs_manager.validate_path(path, js_context.get("user_context"), options_json)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})


def write_file(path, content, js_context_json):
    """Exposes the filesystem's write_file method."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        fs_manager.write_file(path, content, js_context.get('user_context'))
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def create_directory(path, js_context_json):
    """Exposes the filesystem's create_directory method."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        fs_manager.create_directory(path, js_context.get('user_context'))
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def rename_node(old_path, new_path, js_context_json):
    """Exposes the filesystem's rename_node method."""
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        fs_manager.rename_node(old_path, new_path)
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def execute_command(command_string: str, js_context_json: str, stdin_data: str = None) -> str:
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        command_executor.set_context(js_context.get("user_context"), js_context.get("users"), js_context.get("user_groups"), js_context.get("config"), js_context.get("groups"))
        return command_executor.execute(command_string, stdin_data)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}"})