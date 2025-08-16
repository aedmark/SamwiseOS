# gem/core/audit.py

import os
from datetime import datetime
from filesystem import fs_manager

LOG_PATH = "/var/log/audit.log"

class AuditManager:
    """Manages the system audit log, now entirely in Python."""

    def _ensure_log_file_exists(self, user_context):
        """Ensures the log file and its parent directories exist with root ownership."""
        log_dir = os.path.dirname(LOG_PATH)
        if not fs_manager.get_node(log_dir):
            try:
                # Create /var if it doesn't exist
                if not fs_manager.get_node("/var"):
                    fs_manager.create_directory("/var", {"name": "root", "group": "root"})
                # Create /var/log
                fs_manager.create_directory(log_dir, {"name": "root", "group": "root"})
            except Exception as e:
                # If we can't create the dir, we can't log.
                print(f"AuditManager Critical: Could not create log directory {log_dir}: {e}")
                return False

        if not fs_manager.get_node(LOG_PATH):
            try:
                # Create the log file itself as root
                fs_manager.write_file(LOG_PATH, "", {"name": "root", "group": "root"})
                # Set permissions so only root can read/write
                fs_manager.chmod(LOG_PATH, "640")
            except Exception as e:
                print(f"AuditManager Critical: Could not create log file {LOG_PATH}: {e}")
                return False
        return True

    def log(self, actor, action, details, user_context):
        """
        The primary method for logging an event. It directly appends to the log file.
        """
        if not self._ensure_log_file_exists(user_context):
            return {"success": False, "error": "Failed to ensure log file exists."}

        try:
            timestamp = datetime.utcnow().isoformat() + "Z"
            log_entry = f"{timestamp} | USER: {actor} | ACTION: {action} | DETAILS: {details}\\n"

            # Append to the log file
            log_node = fs_manager.get_node(LOG_PATH)
            current_content = log_node.get('content', '')
            new_content = current_content + log_entry

            # Write back as root to maintain ownership
            fs_manager.write_file(LOG_PATH, new_content, {"name": "root", "group": "root"})
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": f"Failed to write to audit log: {repr(e)}"}

# Instantiate a singleton for the kernel
audit_manager = AuditManager()