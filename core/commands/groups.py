# gem/core/commands/groups.py
from groups import group_manager # Import the manager directly

def run(args, flags, user_context, stdin_data=None, users=None, **kwargs):
    # We are no longer accepting user_groups as a parameter.
    # We will get the most current information directly from the source!
    if users is None:
        return {"success": False, "error": "groups: could not retrieve user data from the environment."}

    target_user = args[0] if args else user_context.get('name')

    if target_user not in users:
        return {"success": False, "error": f"groups: user '{target_user}' does not exist"}

    # Get all groups directly from the group manager
    all_groups = group_manager.get_all_groups()
    user_specific_groups = []
    for group, details in all_groups.items():
        if target_user in details.get('members', []):
            user_specific_groups.append(group)

    primary_group = users.get(target_user, {}).get('primaryGroup')

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