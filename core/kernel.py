# gem/core/kernel.py

from executor import command_executor
from filesystem import fs_manager
from session import env_manager, history_manager, alias_manager, session_manager
from groups import group_manager
from users import user_manager
from sudo import SudoManager
from ai_manager import AIManager
from apps.editor import editor_manager
from apps.paint import paint_manager
from apps.adventure import adventure_manager
from apps import top as top_app
from apps import log as log_app
from apps import basic as basic_app
from audit import audit_manager
import json
import traceback
import inspect
import asyncio

# --- Module Initialization ---
sudo_manager = SudoManager(fs_manager)
ai_manager = AIManager(fs_manager, command_executor)
command_executor.set_ai_manager(ai_manager)

MODULE_DISPATCHER = {
    "executor": command_executor, "filesystem": fs_manager, "session": session_manager,
    "env": env_manager, "history": history_manager, "alias": alias_manager,
    "groups": group_manager, "users": user_manager, "sudo": sudo_manager, "ai": ai_manager,
    "editor": editor_manager, "paint": paint_manager,
    "adventure": adventure_manager, "top": top_app, "log": log_app, "basic": basic_app, "audit": audit_manager
}

def initialize_kernel(save_function):
    fs_manager.set_save_function(save_function)

async def syscall_handler(request_json):
    """
    The single, now ASYNC, entry point for all calls from the JavaScript frontend.
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

        if inspect.iscoroutinefunction(target_func):
            result = await target_func(*args, **kwargs)
        else:
            result = target_func(*args, **kwargs)

        if inspect.isawaitable(result):
            result = await result

        if isinstance(result, dict) and 'success' in result:
            return json.dumps(result)
        if isinstance(result, str):
            try:
                json.loads(result)
                return result
            except json.JSONDecodeError: pass
        return json.dumps({"success": True, "data": result})

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Kernel Dispatch Error in {module_name}.{function_name}: {repr(e)}",
            "traceback": traceback.format_exc()
        })

async def execute_command(command_string: str, js_context_json: str, stdin_data: str = None) -> str:
    try:
        return await command_executor.execute(command_string, js_context_json, stdin_data)
    except Exception as e:
        return json.dumps({
            "success": False, "error": f"Kernel Error before execution: {repr(e)}",
            "traceback": traceback.format_exc()
        })

def load_session_state(state_json):
    req = {"module": "session", "function": "load_session_state", "args": [state_json]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def write_file(path, content, user_context):
    py_user_context = user_context.to_py() if hasattr(user_context, 'to_py') else user_context
    req = {"module": "filesystem", "function": "write_file", "args": [path, content, py_user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def create_directory(path, user_context):
    py_user_context = user_context.to_py() if hasattr(user_context, 'to_py') else user_context
    req = {"module": "filesystem", "function": "create_directory", "args": [path, py_user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))


def rename_node(old_path, new_path, js_context_json):
    req = {"module": "filesystem", "function": "rename_node", "args": [old_path, new_path]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

# --- App-specific Stubs ---

def chidi_analysis(js_context_json, files_context, analysis_type, question=None):
    context = json.loads(js_context_json)
    req = { "module": "ai", "function": "perform_chidi_analysis", "kwargs": { "files_context": files_context, "analysis_type": analysis_type, "question": question, "provider": context.get("provider", "gemini"), "model": context.get("model"), "api_key": context.get("api_key")}}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def explorer_get_view(path, js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "explorer", "function": "get_view_data", "args": [path, user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def explorer_toggle_tree(path):
    req = {"module": "explorer", "function": "toggle_tree_expansion", "args": [path]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def explorer_create_node(path, name, node_type, js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "explorer", "function": "create_node", "args": [path, name, node_type, user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def explorer_rename_node(old_path, new_name, js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "explorer", "function": "rename_node", "args": [old_path, new_name, user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def explorer_delete_node(path, js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "explorer", "function": "delete_node", "args": [path, user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def editor_load_file(file_path, file_content):
    req = {"module": "editor", "function": "load_file", "args": [file_path, file_content]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def editor_push_undo(content):
    req = {"module": "editor", "function": "push_undo_state", "args": [content]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def editor_undo():
    req = {"module": "editor", "function": "undo"}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def editor_redo():
    req = {"module": "editor", "function": "redo"}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def editor_update_on_save(path, content):
    req = {"module": "editor", "function": "update_on_save", "args": [path, content]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def paint_get_initial_state(file_path, file_content):
    req = {"module": "paint", "function": "get_initial_state", "args": [file_path, file_content]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def paint_push_undo_state(canvas_data_json):
    req = {"module": "paint", "function": "push_undo_state", "args": [canvas_data_json]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def paint_undo():
    req = {"module": "paint", "function": "undo"}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def paint_redo():
    req = {"module": "paint", "function": "redo"}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def paint_update_on_save(path):
    req = {"module": "paint", "function": "update_on_save", "args": [path]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def adventure_initialize_state(adventure_data_json, scripting_context_json):
    req = {"module": "adventure", "function": "initialize_state", "args": [adventure_data_json, scripting_context_json]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def adventure_process_command(command):
    req = {"module": "adventure", "function": "process_command", "args": [command]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def top_get_process_list(jobs):
    py_jobs = jobs.to_py() if hasattr(jobs, 'to_py') else jobs
    req = {"module": "top", "function": "get_process_list", "args": [py_jobs]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def log_ensure_dir(js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "log", "function": "ensure_log_dir", "args": [user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def log_load_entries(js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "log", "function": "load_entries", "args": [user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def log_save_entry(path, content, js_context_json):
    user_context = json.loads(js_context_json)
    req = {"module": "log", "function": "save_entry", "args": [path, content, user_context]}
    return asyncio.ensure_future(syscall_handler(json.dumps(req)))

def basic_run_program(program_text, output_callback, input_callback):
    return json.dumps(basic_app.run_program(program_text, output_callback, input_callback))