# gem/core/kernel.py

from executor import command_executor
from filesystem import fs_manager
from session import env_manager, history_manager, alias_manager, session_manager
from groups import group_manager
from users import user_manager
from sudo import SudoManager
from ai_manager import AIManager
from apps.explorer import explorer_manager
from apps.editor import editor_manager
from apps.paint import paint_manager
from apps.adventure import adventure_manager
from apps import top as top_app
from apps import log as log_app
from apps import basic as basic_app
import json
import traceback

# --- Module Initialization ---
sudo_manager = SudoManager(fs_manager)
ai_manager = AIManager(fs_manager, command_executor)

# --- Module to Manager Mapping ---
# This dispatcher dictionary makes the syscall_handler clean and extensible.
MODULE_DISPATCHER = {
    "executor": command_executor,
    "filesystem": fs_manager,
    "session": session_manager,
    "env": env_manager,
    "history": history_manager,
    "alias": alias_manager,
    "groups": group_manager,
    "users": user_manager,
    "sudo": sudo_manager,
    "ai": ai_manager,
    "explorer": explorer_manager,
    "editor": editor_manager,
    "paint": paint_manager,
    "adventure": adventure_manager,
    "top": top_app,
    "log": log_app,
    "basic": basic_app,
}

# --- Kernel Initialization ---
def initialize_kernel(save_function):
    """
    Initializes the kernel by setting the save function for the filesystem.
    This is called once from JavaScript when the bridge is ready.
    """
    fs_manager.set_save_function(save_function)

# --- Unified Syscall Handler ---
def syscall_handler(request_json):
    """
    The single entry point for all calls from the JavaScript frontend.
    It parses a JSON request, dispatches it to the appropriate module and function,
    and returns a standardized JSON response.
    """
    try:
        request = json.loads(request_json)
        module_name = request.get("module")
        function_name = request.get("function")
        args = request.get("args", [])
        kwargs = request.get("kwargs", {})

        if module_name not in MODULE_DISPATCHER:
            raise ValueError(f"Unknown module: {module_name}")

        manager = MODULE_DISPATCHER[module_name]
        target_func = getattr(manager, function_name)

        # Execute the function with its arguments
        result = target_func(*args, **kwargs)

        # Standardize the return format
        if isinstance(result, dict) and 'success' in result:
            return json.dumps(result)

        # For functions that return non-dict data on success
        return json.dumps({"success": True, "data": result})

    except Exception as e:
        # Standardized error response
        return json.dumps({
            "success": False,
            "error": f"Kernel Dispatch Error in {module_name}.{function_name}: {repr(e)}",
            "traceback": traceback.format_exc()
        })

# --- Backward Compatibility Stubs (to be removed after JS refactor) ---
# These are kept temporarily to prevent the system from breaking while we
# refactor the JavaScript side to use the new syscall handler.
def execute_command(command_string: str, js_context_json: str, stdin_data: str = None) -> str:
    req = {
        "module": "executor",
        "function": "execute",
        "args": [command_string, js_context_json, stdin_data]
    }
    return syscall_handler(json.dumps(req))

def get_session_state_for_saving():
    req = {"module": "session", "function": "get_session_state_for_saving"}
    return syscall_handler(json.dumps(req))

def load_session_state(state_json):
    req = {"module": "session", "function": "load_session_state", "args": [state_json]}
    return syscall_handler(json.dumps(req))

# ... Add similar stubs for all other old functions in kernel.py ...
# This ensures that if an old JS call is made, it gets routed through the new system.
# Example:
def write_file(path, content, js_context_json):
    req = {
        "module": "filesystem",
        "function": "write_file",
        "args": [path, content, json.loads(js_context_json).get('user_context')]
    }
    return syscall_handler(json.dumps(req))