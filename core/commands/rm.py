# /core/commands/rm.py

from filesystem import fs_manager
import shlex
import os

def define_flags():
    return [
        {'name': 'recursive', 'short': 'r', 'long': 'recursive', 'takes_value': False},
        {'name': 'force', 'short': 'f', 'long': 'force', 'takes_value': False},
        {'name': 'interactive', 'short': 'i', 'long': 'interactive', 'takes_value': False},
        {'name': 'confirmed', 'long': 'confirmed', 'takes_value': True, 'hidden': True},
    ]

def run(args, flags, user_context, **kwargs):
    """ Removes files or directories with interactive and force options. """
    stdin_data = kwargs.get('stdin_data')
    if not args:
        return {"success": False, "error": {"message": "rm: missing operand", "suggestion": "Try 'rm <file_name>'."}}

    is_recursive = flags.get('recursive', False)
    is_force = flags.get('force', False)
    is_interactive = flags.get('interactive', False)
    confirmed_path = flags.get("confirmed")
    is_pre_confirmed = stdin_data and stdin_data.strip().upper() == 'YES'

    output_messages = []

    for path in args:
        abs_path = fs_manager.get_absolute_path(path)
        node = fs_manager.get_node(abs_path)

        if not node:
            if not is_force:
                output_messages.append(f"rm: cannot remove '{path}': No such file or directory")
            continue

        if node.get('type') == 'directory' and not is_recursive:
            output_messages.append(f"rm: cannot remove '{path}': Is a directory")
            continue

        if is_interactive and not is_force and not is_pre_confirmed and abs_path != confirmed_path:
            prompt_type = "directory" if node.get('type') == 'directory' else "regular file"
            return {
                "effect": "confirm",
                "message": [f"rm: remove {prompt_type} '{path}'?"],
                "on_confirm_command": f"rm {'-r ' if is_recursive else ''}{'-f ' if is_force else ''} --confirmed={shlex.quote(abs_path)} {shlex.quote(path)}"
            }

        try:
            fs_manager.remove(abs_path, recursive=True)
        except Exception as e:
            if not is_force:
                output_messages.append(f"rm: cannot remove '{path}': {repr(e)}")

    if output_messages:
        return {
            "success": False,
            "error": {
                "message": "\\n".join(output_messages),
                "suggestion": "Check the file paths and permissions."
            }
        }

    return "" # Success

def man(args, flags, user_context, **kwargs):
    return """
NAME
    rm - remove files or directories

SYNOPSIS
    rm [OPTION]... [FILE]...

DESCRIPTION
    Removes each specified file. By default, it does not remove directories.

OPTIONS
    -f, --force
          ignore nonexistent files and arguments, never prompt
    -i
          prompt before every removal
    -r, -R, --recursive
          remove directories and their contents recursively

EXAMPLES
    rm my_old_file.txt
    rm -i important_document.doc
    rm -rf old_project/
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: rm [OPTION]... [FILE]..."