# gem/core/commands/groupadd.py

from groups import group_manager

def run(args, flags, user_context):
    if user_context.get('name') != 'root':
        return "groupadd: only root can add groups."

    if not args:
        return "groupadd: missing group name"

    group_name = args[0]

    if ' ' in group_name:
        return "groupadd: group names cannot contain spaces."

    if group_manager.group_exists(group_name):
        return f"groupadd: group '{group_name}' already exists."

    if group_manager.create_group(group_name):
        return "" # Success
    else:
        return f"groupadd: failed to create group '{group_name}'."