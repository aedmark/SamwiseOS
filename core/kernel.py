# /core/kernel.py

from executor import command_executor
from filesystem import fs_manager
from session import env_manager, history_manager, alias_manager, session_manager
from groups import group_manager
from users import user_manager
from sudo import SudoManager
from ai_manager import AIManager
import json

sudo_manager = SudoManager(fs_manager)
ai_manager = AIManager(fs_manager, command_executor)

__all__ = ["initialize_kernel", "load_fs_from_json", "save_fs_to_json",
           "get_node_json", "check_permission", "get_node_size",
           "validate_path_json", "write_file", "create_directory",
           "rename_node", "execute_command", "command_executor",
           "env_manager", "history_manager", "alias_manager", "session_manager",
           "group_manager", "user_manager",  "sudo_manager", "ai_manager",
           "get_session_state_for_saving", "load_session_state"]


def initialize_kernel(save_function):
    fs_manager.set_save_function(save_function)

def load_fs_from_json(json_string):
    return fs_manager.load_state_from_json(json_string)

def save_fs_to_json():
    return fs_manager.save_state_to_json()

def get_node_json(path, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        node = fs_manager.get_node(path)
        return json.dumps({"success": True, "node": node})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def check_permission(path, js_context_json, permission_type):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        has_perm = fs_manager.has_permission(path, js_context.get("user_context"), permission_type)
        return json.dumps({"success": True, "has_permission": has_perm})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def get_node_size(path):
    try:
        size = fs_manager.calculate_node_size(path)
        return json.dumps({"success": True, "size": size})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def validate_path_json(path, js_context_json, options_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        result = fs_manager.validate_path(path, js_context.get("user_context"), options_json)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def write_file(path, content, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        fs_manager.write_file(path, content, js_context.get('user_context'))
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def create_directory(path, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        fs_manager.create_directory(path, js_context.get('user_context'))
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def rename_node(old_path, new_path, js_context_json):
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
        command_executor.set_context(
            js_context.get("user_context"),
            js_context.get("users"),
            js_context.get("user_groups"),
            js_context.get("config"),
            js_context.get("groups"),
            js_context.get("jobs"),
            ai_manager,
            js_context.get("api_key")
        )
        return command_executor.execute(command_string, stdin_data)
    except Exception as e:
        import traceback
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}\n{traceback.format_exc()}"})

def get_session_state_for_saving():
    """Bridge function to get the session state as a JSON string."""
    try:
        return session_manager.get_session_state_for_saving()
    except Exception:
        return json.dumps({"commandHistory": [], "environmentVariables": {}, "aliases": {}})

def load_session_state(state_json):
    """Bridge function to load session state from a JSON string."""
    try:
        success = session_manager.load_session_state(state_json)
        return json.dumps({"success": success})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})