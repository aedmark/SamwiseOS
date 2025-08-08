# gem/core/commands/sudo.py

from sudo import sudo_manager

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if not args:
        return "sudo: a command must be provided"

    command_to_run = args[0]
    full_command_str = " ".join(args)
    username = user_context.get('name')

    # The user_groups are passed in from the JS context
    if not sudo_manager.can_user_run_command(username, user_groups.get(username, []), command_to_run):
        return f"sudo: user {username} is not allowed to execute '{full_command_str}' as root."

    # If permissions are okay, send an effect to JS to handle password check and execution
    return {
        "effect": "sudo_exec",
        "command": full_command_str
    }