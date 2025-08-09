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
import json
import os

sudo_manager = SudoManager(fs_manager)
ai_manager = AIManager(fs_manager, command_executor)

__all__ = ["initialize_kernel", "load_fs_from_json", "save_fs_to_json",
           "get_node_json", "check_permission", "get_node_size",
           "validate_path_json", "write_file", "create_directory",
           "rename_node", "execute_command", "command_executor",
           "env_manager", "history_manager", "alias_manager", "session_manager",
           "group_manager", "user_manager",  "sudo_manager", "ai_manager",
           "get_session_state_for_saving", "load_session_state", "write_uploaded_file",
           "restore_system_state", "explorer_get_view", "explorer_toggle_tree",
           "explorer_create_node", "explorer_rename_node", "explorer_delete_node",
           "editor_load_file", "editor_push_undo", "editor_undo", "editor_redo",
           "editor_update_on_save",
           "paint_get_initial_state", "paint_push_undo_state", "paint_undo",
           "paint_redo", "paint_update_on_save",
           "adventure_initialize_state", "adventure_process_command",
           "adventure_creator_initialize", "adventure_creator_get_prompt",
           "adventure_creator_process_command", "top_get_process_list"]


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
        return json.dumps({"success": False, "error": f"Python Kernel Error: {repr(e)}\\n{traceback.format_exc()}"})

def get_session_state_for_saving():
    try:
        return session_manager.get_session_state_for_saving()
    except Exception:
        return json.dumps({"commandHistory": [], "environmentVariables": {}, "aliases": {}})

def load_session_state(state_json):
    try:
        success = session_manager.load_session_state(state_json)
        return json.dumps({"success": success})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def write_uploaded_file(filename, content, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        current_path = js_context.get("current_path", "/")
        user_context = js_context.get("user_context")
        full_path = os.path.join(current_path, filename)
        fs_manager.write_file(full_path, content, user_context)
        return json.dumps({"success": True, "path": full_path})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def restore_system_state(backup_data_json):
    """
    [NEW] Wipes the current kernel state and loads it from a backup object.
    """
    try:
        backup_data = json.loads(backup_data_json)
        fs_manager.load_state_from_json(json.dumps(backup_data.get("fsDataSnapshot", {})))
        user_manager.load_users(backup_data.get("userCredentials", {}))
        group_manager.load_groups(backup_data.get("userGroups", {}))
        session_manager.load_session_state(json.dumps(backup_data.get("sessionState", {})))

        # Force an immediate save of the newly restored filesystem
        fs_manager._save_state()

        return json.dumps({"success": True})
    except Exception as e:
        import traceback
        return json.dumps({"success": False, "error": f"Restore failed: {repr(e)}\n{traceback.format_exc()}"})

def explorer_get_view(path, js_context_json):
    """Bridge function to get explorer view data."""
    try:
        js_context = json.loads(js_context_json)
        user_context = js_context.get("user_context")
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        view_data = explorer_manager.get_view_data(path, user_context)
        return json.dumps({"success": True, "data": view_data})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def explorer_toggle_tree(path):
    """Bridge function to toggle tree expansion state."""
    try:
        explorer_manager.toggle_tree_expansion(path)
        return json.dumps({"success": True})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def explorer_create_node(path, name, node_type, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        result = explorer_manager.create_node(path, name, node_type, js_context.get("user_context"))
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def explorer_rename_node(old_path, new_name, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        result = explorer_manager.rename_node(old_path, new_name, js_context.get("user_context"))
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def explorer_delete_node(path, js_context_json):
    try:
        js_context = json.loads(js_context_json)
        fs_manager.set_context(js_context.get("current_path"), js_context.get("user_groups"))
        result = explorer_manager.delete_node(path, js_context.get("user_context"))
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

# --- Editor Bridge Functions ---
def editor_load_file(file_path, file_content):
    """Bridge to load a file into the Python editor manager."""
    try:
        state = editor_manager.load_file(file_path, file_content)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def editor_push_undo(content):
    """Bridge to push a new state to the undo stack."""
    try:
        state = editor_manager.push_undo_state(content)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def editor_undo():
    """Bridge to perform an undo operation."""
    try:
        result = editor_manager.undo()
        return json.dumps({"success": True, "data": result})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def editor_redo():
    """Bridge to perform a redo operation."""
    try:
        result = editor_manager.redo()
        return json.dumps({"success": True, "data": result})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def editor_update_on_save(path, content):
    """Bridge to update the editor state after a file save."""
    try:
        state = editor_manager.update_on_save(path, content)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def paint_get_initial_state(file_path, file_content):
    """Bridge to get the initial state for the Paint app."""
    try:
        state = paint_manager.get_initial_state(file_path, file_content)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def paint_push_undo_state(canvas_data_json):
    """Bridge to push a new canvas state to the undo stack."""
    try:
        state = paint_manager.push_undo_state(canvas_data_json)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def paint_undo():
    """Bridge to perform a paint undo operation."""
    try:
        state = paint_manager.undo()
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def paint_redo():
    """Bridge to perform a paint redo operation."""
    try:
        state = paint_manager.redo()
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def paint_update_on_save(path):
    """Bridge to update the paint state after a file save."""
    try:
        state = paint_manager.update_on_save(path)
        return json.dumps({"success": True, "data": state})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def adventure_initialize_state(adventure_data_json, scripting_context_json):
    """Bridge for initializing the adventure game state."""
    try:
        result = adventure_manager.initialize_state(adventure_data_json, scripting_context_json)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

def adventure_process_command(command):
    """Bridge for processing a player command."""
    try:
        result = adventure_manager.process_command(command)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})

# Placeholder for Adventure Creator - to be implemented fully later
def adventure_creator_initialize(filename, initial_data_json):
    # This is a stub. Full implementation requires the AdventureCreatorManager class.
    return json.dumps({
        "success": True,
        "message": f"Entering Adventure Creator for '{filename}'.\nType 'help' for commands, 'exit' to quit."
    })

def adventure_creator_get_prompt():
    # Stub
    return json.dumps({"success": True, "prompt": "(creator)> "})

def adventure_creator_process_command(command):
    # Stub
    if command.lower() == 'exit':
        return json.dumps({"success": True, "output": "Exiting Adventure Creator.", "shouldExit": True})
    return json.dumps({
        "success": False,
        "output": f"Unknown command: '{command}'. Creator is not fully implemented yet."
    })

def top_get_process_list(jobs_proxy):
    """
    Bridge to get the process list for the Top app.
    The jobs_proxy is a PyProxy from JS, so we convert it to a Python dict.
    """
    try:
        jobs = jobs_proxy.to_py()
        process_list = top_app.get_process_list(jobs)
        return json.dumps({"success": True, "data": process_list})
    except Exception as e:
        return json.dumps({"success": False, "error": repr(e)})