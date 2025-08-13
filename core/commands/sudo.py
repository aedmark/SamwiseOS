# gem/core/commands/sudo.py
from sudo import sudo_manager
import shlex

def run(args, flags, user_context, user_groups=None, stdin_data=None, **kwargs):
    """
    Handles the 'sudo' command by checking permissions and returning an
    effect for the CommandExecutor to re-run the command with elevated privileges.
    """
    if not args:
        return {"success": False, "error": "sudo: a command must be provided"}

    command_to_run_parts = args
    full_command_str = " ".join(command_to_run_parts)
    username = user_context.get('name')

    groups_for_user = user_groups.get(username, []) if user_groups else []
    command_name = command_to_run_parts[0]

    if not sudo_manager.can_user_run_command(username, groups_for_user, command_name):
        return {"success": False, "error": f"sudo: user {username} is not allowed to execute '{full_command_str}' as root."}

    return {
        "effect": "sudo_exec",
        "command": full_command_str,
        "password": stdin_data
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    sudo - execute a command as another user

SYNOPSIS
    sudo command [args...]

DESCRIPTION
    sudo allows a permitted user to execute a command as the superuser or
    another user, as specified by the security policy in the sudoers file.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the sudo command."""
    return "Usage: sudo <command> [args...]"