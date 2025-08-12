def run(args, flags, user_context, stdin_data=None, **kwargs):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "useradd: only root can add users."}

    if not args:
        return {"success": False, "error": "Usage: useradd <username>"}

    username = args[0]

    if user_manager.user_exists(username):
        return {"success": False, "error": f"useradd: user '{username}' already exists"}

    # This is the new, more robust logic for handling passwords from scripts.
    if stdin_data:
        try:
            # The input from diag.sh will have two lines for the password.
            lines = stdin_data.strip().split('\\n')
            password = lines[0]
            confirm_password = lines[1] if len(lines) > 1 else ''

            if password != confirm_password:
                return {"success": False, "error": "passwd: passwords do not match."}

            # Now, we register the user AND create their home directory all in one go!
            registration_result = user_manager.register_user(username, password, username)
            if registration_result["success"]:
                from filesystem import fs_manager
                home_path = f"/home/{username}"
                # Create the directory, then set the correct owner and group.
                fs_manager.create_directory(home_path, {"name": "root", "group": "root"})
                fs_manager.chown(home_path, username)
                fs_manager.chgrp(home_path, username)
                return {
                    "success": True,
                    "output": f"User '{username}' registered. Home directory created at /home/{username}.",
                    "effect": "sync_user_state",
                    "users": user_manager.get_all_users()
                }
            else:
                return registration_result
        except IndexError:
            return {"success": False, "error": "useradd: insufficient password lines from stdin"}
    else:
        # This part handles interactive `useradd` and stays the same.
        return {
            "effect": "useradd",
            "username": username
        }