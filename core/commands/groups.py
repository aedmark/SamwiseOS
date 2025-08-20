# gem/core/commands/groups.py
from groups import group_manager
from users import user_manager

def run(args, flags, user_context, stdin_data=None, **kwargs):
    target_user = args[0] if args else user_context.get('name')
    all_users = user_manager.get_all_users()

    if target_user not in all_users:
        return {
            "success": False,
            "error": {
                "message": f"groups: user '{target_user}' does not exist",
                "suggestion": "You can view all users with the 'listusers' command."
            }
        }

    all_groups = group_manager.get_all_groups()
    user_specific_groups = []
    for group, details in all_groups.items():
        if target_user in details.get('members', []):
            user_specific_groups.append(group)

    primary_group = all_users.get(target_user, {}).get('primaryGroup')

    group_set = set(user_specific_groups)
    if primary_group:
        group_set.add(primary_group)

    return " ".join(sorted(list(group_set)))

def man(args, flags, user_context, **kwargs):
    return """
NAME
    groups - print the groups a user is in

SYNOPSIS
    groups [USERNAME]

DESCRIPTION
    Print group memberships for each USERNAME. If USERNAME is omitted, the command prints the groups for the current user.

OPTIONS
    This command takes no options.

EXAMPLES
    groups
    groups root
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: groups [USERNAME]"