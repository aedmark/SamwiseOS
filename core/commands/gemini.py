# gem/core/commands/gemini.py

import asyncio
import json

def define_flags():
    """Declares the flags that the gemini command accepts."""
    return [
        {'name': 'chat', 'short': 'c', 'long': 'chat', 'takes_value': False},
        {'name': 'provider', 'short': 'p', 'long': 'provider', 'takes_value': True},
        {'name': 'model', 'short': 'm', 'long': 'model', 'takes_value': True},
        {'name': 'chat-internal', 'long': 'chat-internal', 'takes_value': True, 'hidden': True},
    ]

async def run(args, flags, user_context, stdin_data=None, api_key=None, ai_manager=None, **kwargs):
    """
    Engages in a context-aware conversation with a configured AI model.
    """
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    provider = flags.get('provider', 'ollama')
    model = flags.get('model')

    if flags.get('chat', False):
        return {
            "effect": "launch_app",
            "app_name": "GeminiChat",
            "options": {
                "provider": provider,
                "model": model
            }
        }

    if flags.get('chat-internal'):
        user_prompt = flags.get('chat-internal')
        history = json.loads(stdin_data) if stdin_data else []
        result = await ai_manager.continue_chat_conversation(
            user_prompt,
            history,
            provider,
            model,
            api_key
        )
        if result["success"]:
            return result.get("answer") # Return the raw string output
        else:
            return {"success": False, "error": result["error"]}

    if not args:
        return {"success": False, "error": 'Insufficient arguments. Usage: gemini "<prompt>"'}

    user_prompt = " ".join(args)

    result = await ai_manager.perform_agentic_search(user_prompt, [], provider, model, {"apiKey": api_key})

    if result["success"]:
        # The data from agentic search is already formatted Markdown
        return {
            "effect": "display_prose",
            "header": "Gemini Response",
            "content": result.get("data")
        }
    else:
        return {"success": False, "error": result["error"]}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    gemini - Engages in a context-aware conversation with a configured AI model.

SYNOPSIS
    gemini [-c | --chat] [-p provider] [-m model] "<prompt>"

DESCRIPTION
    The gemini command sends a prompt to a configured AI model, acting as a powerful
    assistant capable of using system tools to answer questions about your files.
    Use the --chat flag to open an interactive, graphical chat session.
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the gemini command."""
    return 'Usage: gemini [-c] "<prompt>"'