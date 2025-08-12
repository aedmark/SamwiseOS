# gem/core/commands/groups.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    if users is None or user_groups is None:
        return {"success": False, "error": "groups: could not retrieve user/group data from the environment."}

    target_user = args[0] if args else user_context.get('name')

    if target_user not in users:
        return {"success": False, "error": f"groups: user '{target_user}' does not exist"}

    groups = user_groups.get(target_user, [])
    primary_group = users.get(target_user, {}).get('primaryGroup')

    # Use a set for efficient checking and adding
    group_set = set(groups)
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