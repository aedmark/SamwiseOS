# gem/core/commands/sudo.py

from sudo import sudo_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if not args:
        return {"success": False, "error": "sudo: a command must be provided"}

    command_to_run_parts = args
    full_command_str = " ".join(command_to_run_parts)
    username = user_context.get('name')

    if not sudo_manager.can_user_run_command(username, user_groups.get(username, []), command_to_run_parts[0]):
        return {"success": False, "error": f"sudo: user {username} is not allowed to execute '{full_command_str}' as root."}

    password = None
    if stdin_data:
        password = stdin_data.strip().split('\\n')[0]

    return {
        "effect": "sudo_exec",
        "command": full_command_str,
        "password": password
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sudo - execute a command as another user

SYNOPSIS
    sudo [command]

DESCRIPTION
    The sudo utility allows a permitted user to execute a command as the
    superuser or another user, as specified by the security policy in
    the /etc/sudoers file.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the sudo command."""
    return "Usage: sudo <command>"