# gem/core/commands/groupdel.py

from groups import group_manager

def run(args, flags, user_context, users=None):
    if user_context.get('name') != 'root':
        return "groupdel: only root can delete groups."

    if not args:
        return "groupdel: missing group name"

    group_name = args[0]

    if not group_manager.group_exists(group_name):
        return f"groupdel: group '{group_name}' does not exist."

    # Check if it's a primary group for any user
    if users:
        for user, details in users.items():
            if details.get('primaryGroup') == group_name:
                return f"groupdel: cannot remove group '{group_name}': it is the primary group of user '{user}'"

    if group_manager.delete_group(group_name):
        return "" # Success
    else:
        return f"groupdel: failed to delete group '{group_name}'."