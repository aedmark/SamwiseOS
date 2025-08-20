# gem/core/commands/sudo.py
from sudo import sudo_manager
from audit import audit_manager
import shlex

def run(args, flags, user_context, user_groups=None, stdin_data=None, **kwargs):
    """
    Handles the 'sudo' command by checking permissions and returning an
    effect for the CommandExecutor to re-run the command with elevated privileges.
    """
    if not args:
        return {
            "success": False,
            "error": {
                "message": "sudo: a command must be provided",
                "suggestion": "Try 'sudo <command>'."
            }
        }

    command_to_run_parts = args
    full_command_str = " ".join(command_to_run_parts)
    username = user_context.get('name')

    audit_manager.log(username, 'SUDO_ATTEMPT', f"Command: {full_command_str}", user_context)

    groups_for_user = user_groups.get(username, []) if user_groups else []
    command_name = command_to_run_parts[0]

    if not sudo_manager.can_user_run_command(username, groups_for_user, command_name):
        audit_manager.log(username, 'SUDO_FAILURE', f"Reason: Not in sudoers for '{command_name}'", user_context)
        return {
            "success": False,
            "error": {
                "message": f"sudo: user {username} is not allowed to execute '{full_command_str}' as root.",
                "suggestion": "Check the /etc/sudoers file or contact an administrator."
            }
        }


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
    sudo allows a permitted user to execute a command as the superuser (root),
    as specified by the security policy in the /etc/sudoers file. The user
    will be prompted for their own password to authenticate.

OPTIONS
    This command takes no options.

EXAMPLES
    sudo ls /root
    sudo useradd new_user
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: sudo <command> [args...]"