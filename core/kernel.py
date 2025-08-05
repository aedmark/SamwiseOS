# gem/core/kernel.py

from executor import command_executor
from filesystem import fs_manager
import json

def initialize_kernel(save_function):
    fs_manager.set_save_function(save_function)

def load_fs_from_json(json_string):
    return fs_manager.load_state_from_json(json_string)

def save_fs_to_json():
    return fs_manager.save_state_to_json()

def get_node_json(path, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_context"))
        node = fs_manager.get_node(path)
        return json.dumps(node)
    except Exception as e:
        return json.dumps({"error": repr(e)})

def check_permission(path, permission_type, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_context"))
        node = fs_manager.get_node(path)
        has_perm = fs_manager.has_permission(node, js_context.get("user_context"), permission_type)
        return json.dumps({"has_permission": has_perm})
    except Exception as e:
        return json.dumps({"error": repr(e)})

def get_node_size(path, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_context"))
        node = fs_manager.get_node(path)
        size = fs_manager.calculate_node_size(node)
        return json.dumps({"size": size})
    except Exception as e:
        return json.dumps({"error": repr(e)})

def validate_path_json(path, options_json, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        options = json.loads(options_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_context"))
        result = fs_manager.validate_path(path, options)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def execute_command(command_string: str, js_context_json: str) -> str:
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_context"))
        command_executor.set_context(js_context.get("user_context"))
        return command_executor.execute(command_string)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}"})