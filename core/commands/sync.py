# gem/core/commands/sync.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    if args:
        return {
            "success": False,
            "error": {
                "message": "sync: command takes no arguments",
                "suggestion": "Simply run 'sync' by itself."
            }
        }
    try:
        fs_manager._save_state()
        return ""
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": f"sync: an error occurred while saving the filesystem",
                "suggestion": f"Details: {repr(e)}"
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sync - synchronize data on disk with memory

SYNOPSIS
    sync

DESCRIPTION
    The sync utility forces a write of all buffered file system data
    to the underlying persistent storage (IndexedDB in the browser). It is
    useful to ensure all changes are saved before a critical operation.

OPTIONS
    This command takes no options.

EXAMPLES
    sync
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: sync"