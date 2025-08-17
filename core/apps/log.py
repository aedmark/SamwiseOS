# gem/core/apps/log.py
import os
import json
from datetime import datetime
from filesystem import fs_manager

LOG_DIR_TEMPLATE = "/home/{username}/.journal"

def _get_log_dir_path(user_context):
    """Gets the log directory path for the current user."""
    username = user_context.get('name', 'guest')
    return LOG_DIR_TEMPLATE.format(username=username)

def ensure_log_dir(user_context):
    """
    Ensures the log directory exists for the user, creating it if necessary.
    """
    log_dir_path = _get_log_dir_path(user_context)
    try:
        if not fs_manager.get_node(log_dir_path):
            # The fs_manager will handle creating parent dirs if needed
            fs_manager.create_directory(log_dir_path, user_context)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to ensure log directory: {repr(e)}"}

def load_entries(user_context):
    """
    Loads, parses, and sorts all log entries for a user.
    """
    log_dir_path = _get_log_dir_path(user_context)
    log_dir_node = fs_manager.get_node(log_dir_path)

    if not log_dir_node or log_dir_node.get('type') != 'directory':
        return []

    entries = []
    for filename, file_node in log_dir_node.get('children', {}).items():
        if filename.endswith(".md") and file_node.get('type') == 'file':
            try:
                # Corrected parsing logic to match the new, simpler filename format
                ts_part = filename.replace(".md", "")
                # Reconstruct an ISO-8601 compatible string from our filename format
                iso_ts_str = f"{ts_part[:10]}T{ts_part[11:13]}:{ts_part[14:16]}:{ts_part[17:19]}.{ts_part[20:23]}Z"
                timestamp = datetime.fromisoformat(iso_ts_str.replace("Z", "+00:00"))

                entries.append({
                    "timestamp": timestamp.isoformat() + "Z",
                    "content": file_node.get('content', ''),
                    "path": os.path.join(log_dir_path, filename)
                })
            except (ValueError, IndexError):
                # Skip files with malformed names
                continue

    # Sort entries by timestamp, newest first
    entries.sort(key=lambda e: e['timestamp'], reverse=True)
    return entries

def save_entry(path, content, user_context):
    """
    Saves content to a specific log entry file.
    This reuses the core write_file function.
    """
    try:
        fs_manager.write_file(path, content, user_context)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": repr(e)}