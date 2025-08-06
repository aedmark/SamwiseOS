# gem/core/commands/sync.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    try:
        # This protected method call is a special case for sync
        fs_manager._save_state()
        return "" # Success, no output
    except Exception as e:
        return f"sync: an error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    sync - synchronize data on disk with memory

SYNOPSIS
    sync

DESCRIPTION
    The sync utility forces a write of all buffered file system data
    to the underlying persistent storage.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: sync"