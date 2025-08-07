# gem/core/commands/fsck.py

from filesystem import fs_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    if user_context.get('name') != 'root':
        return "fsck: permission denied. You must be root to run this command."

    is_repair = "--repair" in flags

    report, changes_made = fs_manager.fsck(users, groups, repair=is_repair)

    if not report:
        return "Filesystem check complete. No issues found."

    output = ["Filesystem check found the following issues:"]
    output.extend([f" - {item}" for item in report])

    if changes_made:
        output.append("\nRepairs were made. It is recommended to review the changes.")
    else:
        output.append("\nNo repairs were made. Run with '--repair' to fix issues.")

    return "\n".join(output)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return """
NAME
    fsck - check and repair a file system

SYNOPSIS
    fsck [OPTION]...

DESCRIPTION
    fsck is used to check and optionally repair one or more file systems.
    
    --repair
          Attempt to repair any issues found.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None):
    return "Usage: fsck [--repair]"