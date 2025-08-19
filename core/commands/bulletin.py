# gem/core/commands/bulletin.py

import json
from datetime import datetime
from filesystem import fs_manager

BULLETIN_PATH = "/var/log/bulletin.md"

def define_flags():
    """Declares the flags that this command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def _ensure_bulletin_exists(user_context):
    """Ensures the bulletin file and its parent directories exist."""
    log_dir_path = "/var/log"
    if not fs_manager.get_node(log_dir_path):
        try:
            if not fs_manager.get_node("/var"):
                fs_manager.create_directory("/var", {"name": "root", "group": "root"})
            fs_manager.create_directory(log_dir_path, {"name": "root", "group": "root"})
        except Exception:
            return False

    if not fs_manager.get_node(BULLETIN_PATH):
        try:
            initial_content = "# OopisOS Town Bulletin\n"
            fs_manager.write_file(BULLETIN_PATH, initial_content, user_context)
            fs_manager.chown(BULLETIN_PATH, "root")
            fs_manager.chgrp(BULLETIN_PATH, "towncrier")
            fs_manager.chmod(BULLETIN_PATH, "0o666")
        except Exception:
            return False
    return True

def run(args, flags, user_context, **kwargs):
    """
    Manages the system-wide bulletin board.
    """
    if not args:
        return {"success": False, "error": "bulletin: missing sub-command. Use 'post', 'list', or 'clear'."}

    sub_command = args[0].lower()

    if not _ensure_bulletin_exists(user_context):
        return {"success": False, "error": "bulletin: could not initialize the bulletin board file."}

    if sub_command == "post":
        if len(args) < 2:
            return {"success": False, "error": "bulletin post: requires a message in quotes."}

        message = " ".join(args[1:])
        timestamp = datetime.utcnow().isoformat() + "Z"

        user_groups = kwargs.get('user_groups', {}).get(user_context.get('name', ''), [])
        is_town_crier = 'towncrier' in user_groups or 'root' in user_groups
        post_header = "Official Announcement" if is_town_crier else "Message"

        new_entry = f"""
---
**Posted by:** {user_context.get('name')} on {timestamp}
**{post_header}:**
{message}
"""
        try:
            current_content = fs_manager.get_node(BULLETIN_PATH).get('content', '')
            new_content = current_content + new_entry
            fs_manager.write_file(BULLETIN_PATH, new_content, user_context)
            return "Message posted to bulletin."
        except Exception as e:
            return {"success": False, "error": f"bulletin: could not post message: {repr(e)}"}

    elif sub_command == "list":
        node = fs_manager.get_node(BULLETIN_PATH)
        return node.get('content', '')

    elif sub_command == "clear":
        if user_context.get('name') != 'root':
            return {"success": False, "error": "bulletin clear: only root can clear the bulletin board."}

        cleared_content = "# OopisOS Town Bulletin (cleared)\n"
        try:
            fs_manager.write_file(BULLETIN_PATH, cleared_content, user_context)
            return "Bulletin board cleared."
        except Exception as e:
            return {"success": False, "error": f"bulletin: could not clear bulletin: {repr(e)}"}

    else:
        return {"success": False, "error": f"bulletin: unknown sub-command '{sub_command}'."}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    bulletin - Manages the system-wide bulletin board.

SYNOPSIS
    bulletin <sub-command> [options]

DESCRIPTION
    Manages the system-wide, persistent message board located at /var/log/bulletin.md.

SUB-COMMANDS:
    post "<message>"   Appends a new, timestamped message to the board.
    list               Displays all messages on the board.
    clear              Clears all messages from the board (root only).
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the bulletin command."""
    return "Usage: bulletin <post|list|clear> [options]"