# gem/core/commands/groups.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if users is None or user_groups is None:
        return "groups: could not retrieve user/group data from the environment."

    target_user = args[0] if args else user_context.get('name')

    if target_user not in users:
        return f"groups: user '{target_user}' does not exist"

    # The user_groups dictionary is structured as {username: [group1, group2]}
    groups = user_groups.get(target_user, [])

    # Ensure the user's primary group is included if not already present
    primary_group = users.get(target_user, {}).get('primaryGroup')
    if primary_group and primary_group not in groups:
        groups.insert(0, primary_group)

    return " ".join(sorted(groups))

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