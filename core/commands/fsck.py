# gem/core/commands/fsck.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the fsck command accepts."""
    return {
        'flags': [
            {'name': 'repair', 'long': 'repair', 'takes_value': False},
        ],
        'metadata': {
            'root_required': True
        }
    }


def run(args, flags, user_context, users=None, groups=None, **kwargs):
    is_repair = flags.get('repair', False)
    report, changes_made = fs_manager.fsck(users, groups, repair=is_repair)

    if not report:
        return "Filesystem check complete. No issues found."

    output = ["Filesystem check found the following issues:"]
    output.extend([f" - {item}" for item in report])

    if changes_made:
        output.append("\\nRepairs were made. It is recommended to review the changes.")
    else:
        output.append("\\nNo repairs were made. Run with '--repair' to fix issues.")

    return "\\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    fsck - check and repair a file system

SYNOPSIS
    fsck [--repair]

DESCRIPTION
    fsck is used to check and optionally repair the virtual file system. It checks for orphaned nodes (files owned by non-existent users/groups), dangling symbolic links, and ensures every user has a home directory.

OPTIONS
    --repair
          Attempt to repair any issues found. Orphaned nodes will be reassigned to root, and dangling links will be removed.

EXAMPLES
    sudo fsck
    sudo fsck --repair
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: fsck [--repair]"