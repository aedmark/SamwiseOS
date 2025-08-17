# gem/core/commands/storyboard.py

import os
from filesystem import fs_manager

SUPPORTED_EXTENSIONS = {".md", ".txt", ".html", ".js", ".sh", ".css", ".json"}

def define_flags():
    """Declares the flags that the storyboard command accepts."""
    return [
        {'name': 'mode', 'long': 'mode', 'takes_value': True},
        {'name': 'summary', 'long': 'summary', 'takes_value': False},
        {'name': 'ask', 'long': 'ask', 'takes_value': True},
        {'name': 'provider', 'long': 'provider', 'takes_value': True},
        {'name': 'model', 'long': 'model', 'takes_value': True},
    ]

def _get_files_for_analysis(start_path, user_context):
    """
    Recursively finds all supported files for analysis from a starting path.
    """
    files = []
    visited = set()
    start_node = fs_manager.get_node(start_path)

    def recurse(current_path, node):
        if current_path in visited: return
        visited.add(current_path)
        if not fs_manager.has_permission(current_path, user_context, "read"): return

        if node.get('type') == 'file':
            _, ext = os.path.splitext(current_path)
            if ext.lower() in SUPPORTED_EXTENSIONS:
                files.append({
                    "name": os.path.basename(current_path),
                    "path": current_path,
                    "content": node.get('content', '')
                })
        elif node.get('type') == 'directory':
            if not fs_manager.has_permission(current_path, user_context, "execute"): return
            for child_name in sorted(node.get('children', {}).keys()):
                child_path = fs_manager.get_absolute_path(os.path.join(current_path, child_name))
                recurse(child_path, node['children'][child_name])

    if start_node:
        recurse(start_path, start_node)
    return files

async def run(args, flags, user_context, stdin_data=None, ai_manager=None, api_key=None, **kwargs):
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    files_to_analyze = []
    if stdin_data:
        paths_from_pipe = stdin_data.strip().splitlines()
        for path in paths_from_pipe:
            if not path.strip(): continue
            node = fs_manager.get_node(path)
            if not node or node.get('type') != 'file': continue
            _, ext = os.path.splitext(path)
            if ext.lower() in SUPPORTED_EXTENSIONS:
                files_to_analyze.append({"name": os.path.basename(path), "path": path, "content": node.get('content', '')})
    else:
        start_path = fs_manager.get_absolute_path(args[0] if args else ".")
        files_to_analyze = _get_files_for_analysis(start_path, user_context)

    if not files_to_analyze:
        return "No supported files found to analyze."

    result = await ai_manager.perform_storyboard(
        files_to_analyze,
        mode=flags.get('mode', 'code'),
        is_summary=flags.get('summary', False),
        question=flags.get('ask'),
        provider=flags.get('provider', 'ollama'),
        model=flags.get('model'),
        api_key=api_key
    )

    if result.get("success"):
        return {
            "effect": "display_prose",
            "header": "### Project Storyboard",
            "content": result.get("data")
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

def help(args, flags, user_context, **kwargs):
    """Provides help information for the storyboard command."""
    return "Usage: storyboard [OPTIONS] [path]"