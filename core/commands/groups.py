# gem/core/commands/groups.py
from groups import group_manager # Import the manager directly
from users import user_manager # Import the user manager too!

def run(args, flags, user_context, stdin_data=None, **kwargs):
    # This command is now fully self-sufficient and doesn't need 'users' passed in.
    # It gets all its information from the source of truth: our wonderful managers!

    target_user = args[0] if args else user_context.get('name')
    all_users = user_manager.get_all_users() # Get the freshest user data!

    if target_user not in all_users:
        return {"success": False, "error": f"groups: user '{target_user}' does not exist"}

    # Get all groups directly from the group manager
    all_groups = group_manager.get_all_groups()
    user_specific_groups = []
    for group, details in all_groups.items():
        if target_user in details.get('members', []):
            user_specific_groups.append(group)

    # Get the primary group from our fresh user data
    primary_group = all_users.get(target_user, {}).get('primaryGroup')

    # Use a set for efficient checking and adding
    group_set = set(user_specific_groups)
    if primary_group:
        group_set.add(primary_group)

    return " ".join(sorted(list(group_set)))

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    groups - print the groups a user is in

SYNOPSIS
    groups [USERNAME]

DESCRIPTION
    Print group memberships for each USERNAME, or the current process if
    unspecified.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: groups [USERNAME]"