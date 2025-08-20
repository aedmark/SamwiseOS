# gem/core/commands/binder.py

import json
from filesystem import fs_manager
from users import user_manager
import shlex

def define_flags():
    """Declares the flags that the binder command accepts."""
    return {
        'flags': [
            {'name': 'section', 'short': 's', 'long': 'section', 'takes_value': True},
        ],
        'metadata': {}
    }

def _read_binder_file(binder_path):
    """Helper to read and parse a binder file."""
    node = fs_manager.get_node(binder_path)
    if not node:
        return None, f"binder: file '{binder_path}' not found."
    if node.get('type') != 'file':
        return None, f"binder: '{binder_path}' is not a file."
    try:
        data = json.loads(node.get('content', '{}'))
        return data, None
    except json.JSONDecodeError:
        return None, f"binder: could not parse '{binder_path}'. Invalid format."

def _write_binder_file(binder_path, data, user_context):
    """Helper to write data back to a binder file."""
    try:
        content = json.dumps(data, indent=2)
        fs_manager.write_file(binder_path, content, user_context)
        return True, None
    except Exception as e:
        return False, f"binder: failed to write to file: {repr(e)}"

def run(args, flags, user_context, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "binder: missing sub-command",
                "suggestion": "Try 'binder create', 'binder add', 'binder list', 'binder remove', or 'binder exec'. See 'man binder' for details."
            }
        }

    sub_command = args[0].lower()

    if sub_command == "create":
        if len(args) != 2:
            return {"success": False, "error": {"message": "binder: missing operand", "suggestion": "Try 'binder create <binder_name>'."}}

        binder_name = args[1]
        if not binder_name.endswith('.binder'):
            binder_name += '.binder'

        abs_path = fs_manager.get_absolute_path(binder_name)
        if fs_manager.get_node(abs_path):
            return {"success": False, "error": {"message": f"binder: file '{binder_name}' already exists", "suggestion": "Please choose a different name for your binder."}}

        initial_content = { "name": args[1].replace('.binder', ''), "description": "A collection of related files.", "sections": { "general": [] } }
        success, error = _write_binder_file(abs_path, initial_content, user_context)

        if success:
            return f"Binder '{binder_name}' created successfully."
        return {"success": False, "error": {"message": "binder: failed to create binder", "suggestion": error}}

    elif sub_command == "add":
        if len(args) != 3:
            return {"success": False, "error": {"message": "binder: incorrect number of arguments", "suggestion": "Try 'binder add <binder_file> <path_to_add>'."}}

        binder_path, path_to_add = args[1], args[2]
        section = flags.get("section") or 'general'

        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": {"message": error, "suggestion": "Ensure the binder file exists and is correctly formatted."}}

        if not fs_manager.get_node(path_to_add):
            return {"success": False, "error": {"message": f"binder: cannot add path '{path_to_add}'", "suggestion": "No such file or directory exists at the specified path."}}

        abs_path_to_add = fs_manager.get_absolute_path(path_to_add)

        binder_data.setdefault('sections', {}).setdefault(section, [])
        if abs_path_to_add not in binder_data['sections'][section]:
            binder_data['sections'][section].append(abs_path_to_add)
            binder_data['sections'][section].sort()

            success, error = _write_binder_file(binder_path, binder_data, user_context)
            if success:
                return f"Added '{path_to_add}' to the '{section}' section of '{binder_path}'."
            return {"success": False, "error": {"message": "binder: failed to add path", "suggestion": error}}
        return f"Path '{path_to_add}' is already in the '{section}' section."

    elif sub_command == "list":
        if len(args) != 2:
            return {"success": False, "error": {"message": "binder: missing operand", "suggestion": "Try 'binder list <binder_file>'."}}

        binder_path = args[1]
        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": {"message": error, "suggestion": "Ensure the binder file exists and is correctly formatted."}}

        output = [f"Binder: {binder_data.get('name', 'Untitled')}"]
        if binder_data.get('description'):
            output.append(f"Description: {binder_data['description']}")
        output.append('---')

        sections = binder_data.get('sections', {})
        if not sections:
            output.append("(This binder is empty)")
        else:
            for section, paths in sections.items():
                output.append(f"[{section}]")
                if not paths:
                    output.append("  (empty section)")
                else:
                    for path in paths:
                        status = '' if fs_manager.get_node(path) else ' [MISSING]'
                        output.append(f"  - {path}{status}")
        return "\n".join(output)

    elif sub_command == "remove":
        if len(args) != 3:
            return {"success": False, "error": {"message": "binder: incorrect number of arguments", "suggestion": "Try 'binder remove <binder_file> <path_to_remove>'."}}

        binder_path, path_to_remove = args[1], args[2]
        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": {"message": error, "suggestion": "Ensure the binder file exists and is correctly formatted."}}

        abs_path_to_remove = fs_manager.get_absolute_path(path_to_remove)
        removed = False
        for section in binder_data.get('sections', {}):
            if abs_path_to_remove in binder_data['sections'][section]:
                binder_data['sections'][section].remove(abs_path_to_remove)
                removed = True
                break

        if removed:
            success, error = _write_binder_file(binder_path, binder_data, user_context)
            if success:
                return f"Removed '{path_to_remove}' from '{binder_path}'."
            return {"success": False, "error": {"message": "binder: failed to remove path", "suggestion": error}}
        return {"success": False, "error": {"message": f"binder: path '{path_to_remove}' not found in binder", "suggestion": "Use 'binder list' to see all paths in the binder."}}

    elif sub_command == "exec":
        try:
            separator_index = args.index('--')
            binder_path = args[1]
            command_parts = args[separator_index + 1:]
        except ValueError:
            return {"success": False, "error": {"message": "binder: missing '--' separator for exec", "suggestion": "Try 'binder exec <binder_file> -- <command> {}'."}}

        if not command_parts:
            return {"success": False, "error": {"message": "binder: missing command for 'exec'", "suggestion": "You must provide a command to execute after '--'."}}

        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": {"message": error, "suggestion": "Ensure the binder file exists and is correctly formatted."}}

        all_paths = [path for section in binder_data.get('sections', {}).values() for path in section]
        if not all_paths:
            return "Binder is empty, nothing to execute."

        commands_to_run = []
        for path in all_paths:
            if fs_manager.get_node(path):
                # Replace placeholder {} with the quoted path
                cmd_str = ' '.join([shlex.quote(path) if part == '{}' else part for part in command_parts])
                commands_to_run.append(cmd_str)

        return {
            "effect": "execute_commands",
            "commands": commands_to_run,
            "output": f"Executing commands for {len(commands_to_run)} items in binder..."
        }

    else:
        return {"success": False, "error": {"message": f"binder: unknown sub-command '{sub_command}'", "suggestion": "Available sub-commands are: create, add, list, remove, exec."}}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    binder - A tool for creating and managing collections of files.

SYNOPSIS
    binder <sub-command> [options]

DESCRIPTION
    Manages .binder files, which are JSON files that group related project files together into sections. This allows for bulk operations on a set of files, even if they are in different directories.

OPTIONS
    -s, --section <name>
          Specify a section name when adding files. Defaults to 'general'.

SUB-COMMANDS:
    create <name>
        Creates a new, empty binder file.
    add <binder> <path>
        Adds a file or directory path to a binder. Use with -s to specify a section.
    list <binder>
        Lists the contents of a binder, organized by section.
    remove <binder> <path>
        Removes a path from any section in a binder.
    exec <binder> -- <cmd>
        Executes a command for each path in a binder. Use '{}' as a placeholder for the path.

EXAMPLES:
    binder create my_project
    binder add my_project.binder README.md -s docs
    binder add my_project.binder /home/guest/main.js -s scripts
    binder list my_project.binder
    binder exec my_project.binder -- cat {}
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: binder <create|add|list|remove|exec> [options]"