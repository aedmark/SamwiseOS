# gem/core/commands/log.py

from filesystem import fs_manager
from datetime import datetime
import os

def run(args, flags, user_context, **kwargs):
    """
    Launches the Log application or performs a quick-add entry.
    """
    if args:
        user_home = f"/home/{user_context.get('name', 'guest')}"
        log_dir_path = os.path.join(user_home, ".journal")

        if not fs_manager.get_node(log_dir_path):
            try:
                fs_manager.create_directory(log_dir_path, user_context)
            except Exception as e:
                return {"success": False, "error": f"log: failed to create log directory: {repr(e)}"}

        entry_text = " ".join(args)
        timestamp = datetime.utcnow().isoformat()[:-3].replace(":", "-").replace(".", "-") + "Z"
        filename = f"{timestamp.replace('T', 'T-')}.md"
        full_path = os.path.join(log_dir_path, filename)

        try:
            fs_manager.write_file(full_path, entry_text, user_context)
            return f"Log entry saved to {full_path}"
        except Exception as e:
            return {"success": False, "error": f"log: failed to save entry: {repr(e)}"}
    else:
        return {
            "effect": "launch_app",
            "app_name": "Log",
            "options": {}
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    log - A personal, timestamped journal and log application.

SYNOPSIS
    log ["entry text"]

DESCRIPTION
    The 'log' command serves as your personal, timestamped journal.
    - Quick Add Mode: Running 'log' with a quoted string creates a new entry.
    - Application Mode: Running 'log' with no arguments launches the graphical app.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the log command."""
    return 'Usage: log ["entry text"]'