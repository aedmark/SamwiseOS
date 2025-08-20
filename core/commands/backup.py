# gem/core/commands/backup.py
import json
import zlib
from datetime import datetime
from filesystem import fs_manager
from session import session_manager
from users import user_manager
from groups import group_manager

def define_flags():
    """Declares the flags that this command accepts."""
    return {
        'flags': [],
        'metadata': {
            'root_required': True
        }
    }

def run(args, flags, user_context, **kwargs):
    """
    Gathers all system state and returns an effect to trigger a backup download.
    """
    if args:
        return {"success": False, "error": "backup: command takes no arguments"}

    try:
        # 1. Gather all data from Python managers
        fs_data_str = fs_manager.save_state_to_json()
        fs_data = json.loads(fs_data_str)

        all_users = user_manager.get_all_users()
        all_groups = group_manager.get_all_groups()

        session_state_str = session_manager.get_session_state_for_saving()
        session_data = json.loads(session_state_str)

        # 2. Assemble the data package
        data_to_backup = {
            "dataType": "SamwiseOS_System_State_Backup_v5.0_Python",
            "osVersion": "0.1",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "fsDataSnapshot": fs_data,
            "userCredentials": all_users,
            "userGroups": all_groups,
            "sessionState": session_data
        }

        # 3. Create a checksum for data integrity
        stringified_data = json.dumps(data_to_backup, sort_keys=True)
        checksum = zlib.crc32(stringified_data.encode('utf-8'))

        # 4. Add checksum and create the final backup object
        final_backup_object = {
            "checksum": checksum,
            **data_to_backup
        }

        backup_json_string = json.dumps(final_backup_object, indent=2)
        default_filename = f"SamwiseOS_Backup_{user_context.get('name')}_{datetime.utcnow().isoformat().replace(':', '-')}.json"

        # 5. Return an effect for the JS side to handle the download
        return {
            "effect": "backup_data",
            "content": backup_json_string,
            "filename": default_filename,
            "output": f"Backup data prepared for {default_filename}."
        }

    except Exception as e:
        import traceback
        return {"success": False, "error": f"Backup failed in Python kernel: {repr(e)}\\n{traceback.format_exc()}"}


def man(args, flags, user_context, **kwargs):
    return """
NAME
    backup - Creates a secure backup of the current SamwiseOS system state.

SYNOPSIS
    backup

DESCRIPTION
    Creates a JSON file containing a snapshot of the current system state,
    including the filesystem, users, groups, and session data. The backup
    includes a checksum for integrity verification. This command can only be
    run by the 'root' user.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: backup"