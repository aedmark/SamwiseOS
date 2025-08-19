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
        return {"success": False, "error": "binder: missing sub-command. See 'help binder'."}

    sub_command = args[0].lower()

    if sub_command == "create":
        if len(args) != 2:
            return {"success": False, "error": "Usage: binder create <binder_name>"}

        binder_name = args[1]
        if not binder_name.endswith('.binder'):
            binder_name += '.binder'

        abs_path = fs_manager.get_absolute_path(binder_name)
        if fs_manager.get_node(abs_path):
            return {"success": False, "error": f"binder: file '{binder_name}' already exists."}

        initial_content = { "name": args[1].replace('.binder', ''), "description": "A collection of related files.", "sections": { "general": [] } }
        success, error = _write_binder_file(abs_path, initial_content, user_context)

        if success:
            return f"Binder '{binder_name}' created successfully."
        return {"success": False, "error": error}

    elif sub_command == "add":
        if len(args) != 3:
            return {"success": False, "error": "Usage: binder add <binder_file> <path_to_add>"}

        binder_path, path_to_add = args[1], args[2]
        section = flags.get("section") or 'general'

        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": error}

        if not fs_manager.get_node(path_to_add):
            return {"success": False, "error": f"binder: cannot add path '{path_to_add}': No such file or directory"}

        abs_path_to_add = fs_manager.get_absolute_path(path_to_add)

        binder_data.setdefault('sections', {}).setdefault(section, [])
        if abs_path_to_add not in binder_data['sections'][section]:
            binder_data['sections'][section].append(abs_path_to_add)
            binder_data['sections'][section].sort()

            success, error = _write_binder_file(binder_path, binder_data, user_context)
            if success:
                return f"Added '{path_to_add}' to the '{section}' section of '{binder_path}'."
            return {"success": False, "error": error}
        return f"Path '{path_to_add}' is already in the '{section}' section."

    elif sub_command == "list":
        if len(args) != 2:
            return {"success": False, "error": "Usage: binder list <binder_file>"}

        binder_path = args[1]
        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": error}

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
            return {"success": False, "error": "Usage: binder remove <binder_file> <path_to_remove>"}

        binder_path, path_to_remove = args[1], args[2]
        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": error}

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
            return {"success": False, "error": error}
        return {"success": False, "error": f"Path '{path_to_remove}' not found in binder."}

    elif sub_command == "exec":
        try:
            separator_index = args.index('--')
            binder_path = args[1]
            command_parts = args[separator_index + 1:]
        except ValueError:
            return {"success": False, "error": "Usage: binder exec <binder_file> -- <command>"}

        if not command_parts:
            return {"success": False, "error": "binder: missing command for 'exec'"}

        binder_data, error = _read_binder_file(binder_path)
        if error: return {"success": False, "error": error}

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
        return {"success": False, "error": f"binder: unknown sub-command '{sub_command}'."}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    binder - A tool for creating and managing collections of files.

SYNOPSIS
    binder <sub-command> [options]

DESCRIPTION
    Manages .binder files, which are JSON files that group related project
    files together into sections, allowing for bulk operations.

SUB-COMMANDS:
    create <name>            - Creates a new, empty binder file.
    add <binder> <path> [-s] - Adds a file/dir path to a binder section.
    list <binder>            - Lists the contents of a binder.
    remove <binder> <path>   - Removes a path from a binder.
    exec <binder> -- <cmd>   - Executes a command for each path in a binder.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the binder command."""
    return "Usage: binder <create|add|list|remove|exec> [options]"