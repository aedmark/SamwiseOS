# gem/core/commands/remix.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the remix command accepts."""
    return [
        {'name': 'provider', 'short': 'p', 'long': 'provider', 'takes_value': True},
        {'name': 'model', 'short': 'm', 'long': 'model', 'takes_value': True},
    ]

def run(args, flags, user_context, stdin_data=None, api_key=None, ai_manager=None, **kwargs):
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    if len(args) != 2:
        return {"success": False, "error": "Usage: remix <file1> <file2>"}

    path1, path2 = args
    node1 = fs_manager.get_node(path1)
    node2 = fs_manager.get_node(path2)

    if not node1:
        return {"success": False, "error": f"remix: {path1}: No such file or directory"}
    if not node2:
        return {"success": False, "error": f"remix: {path2}: No such file or directory"}

    content1 = node1.get('content', '')
    content2 = node2.get('content', '')

    if not content1.strip() or not content2.strip():
        return {"success": False, "error": "remix: One or both input files are empty."}

    provider = flags.get("provider") or "gemini"
    model = flags.get("model")

    result = ai_manager.perform_remix(path1, content1, path2, content2, provider, model, api_key)

    if result["success"]:
        return {
            "effect": "display_prose",
            "header": f"### Remix of {path1} & {path2}",
            "content": result["data"]
        }
    else:
        return result

def man(args, flags, user_context, **kwargs):
    return """
NAME
    remix - Synthesizes a new article from two source documents using AI.

SYNOPSIS
    remix [-p provider] [-m model] <file1> <file2>

DESCRIPTION
    The remix command uses the AI Manager to read two source files,
    understand the core ideas of each, and then generate a new,
    summarized article that synthesizes the information from both.
"""