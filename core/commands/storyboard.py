# gem/core/commands/storyboard.py

import os
from filesystem import fs_manager

SUPPORTED_EXTENSIONS = {".md", ".txt", ".html", ".js", ".sh", ".css", ".json"}

def _get_files_for_analysis(start_path, user_context):
    """
    Recursively finds all supported files for analysis from a starting path.
    """
    files = []
    visited = set()
    start_node = fs_manager.get_node(start_path)

    def recurse(current_path, node):
        if current_path in visited:
            return
        visited.add(current_path)

        if not fs_manager.has_permission(current_path, user_context, "read"):
            return

        if node.get('type') == 'file':
            _, ext = os.path.splitext(current_path)
            if ext.lower() in SUPPORTED_EXTENSIONS:
                files.append({
                    "name": os.path.basename(current_path),
                    "path": current_path,
                    "content": node.get('content', '')
                })
        elif node.get('type') == 'directory':
            if not fs_manager.has_permission(current_path, user_context, "execute"):
                return
            for child_name in sorted(node.get('children', {}).keys()):
                child_path = fs_manager.get_absolute_path(os.path.join(current_path, child_name))
                child_node = node['children'][child_name]
                recurse(child_path, child_node)

    if start_node:
        recurse(start_path, start_node)
    return files

def run(args, flags, user_context, stdin_data=None, ai_manager=None, api_key=None, **kwargs):
    """
    Gathers files and uses the AI Manager to generate a project storyboard.
    """
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    files_to_analyze = []
    # ... (Logic to gather files from args or stdin_data will go here) ...

    # For now, let's assume we gather files correctly.
    # The main part is calling the new AI Manager function.

    # This is a simplified stand-in for file gathering for now.
    start_path_arg = args[0] if args else "."
    start_path = fs_manager.get_absolute_path(start_path_arg)
    files_to_analyze = _get_files_for_analysis(start_path, user_context)

    if not files_to_analyze:
        return "No supported files found to analyze."

    # Calling the new, dedicated function in our Python AI Manager
    result = ai_manager.perform_storyboard(
        files_to_analyze,
        flags.get('--mode', 'code'),
        flags.get('--summary', False),
        flags.get('--ask'),
        flags.get('--provider', 'gemini'),
        flags.get('--model'),
        api_key
    )

    if result["success"]:
        return {
            "effect": "display_prose",
            "header": "### Project Storyboard",
            "content": result["data"]
        }
    else:
        return result

def man(args, flags, user_context, **kwargs):
    return """
NAME
    storyboard - Analyzes and creates a narrative summary of files.

SYNOPSIS
    storyboard [OPTIONS] [path]
    <command> | storyboard [OPTIONS]

DESCRIPTION
    Analyzes a set of files to describe their collective purpose and structure.
    ... (Full man page) ...
"""