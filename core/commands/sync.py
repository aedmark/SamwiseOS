# gem/core/commands/sync.py

from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    if args:
        return {"success": False, "error": "sync: command takes no arguments"}
    try:
        fs_manager._save_state()
        return "" # Success, no output
    except Exception as e:
        return {"success": False, "error": f"sync: an error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sync - synchronize data on disk with memory

SYNOPSIS
    sync

DESCRIPTION
    The sync utility forces a write of all buffered file system data
    to the underlying persistent storage.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the sync command."""
    return "Usage: sync"