# gem/core/commands/gemini.py

import asyncio
import json

def define_flags():
    """Declares the flags that the gemini command accepts."""
    return {
        'flags': [
            {'name': 'chat', 'short': 'c', 'long': 'chat', 'takes_value': False},
            {'name': 'provider', 'short': 'p', 'long': 'provider', 'takes_value': True},
            {'name': 'model', 'short': 'm', 'long': 'model', 'takes_value': True},
            {'name': 'chat-internal', 'long': 'chat-internal', 'takes_value': True, 'hidden': True},
        ],
        'metadata': {}
    }

async def run(args, flags, user_context, stdin_data=None, api_key=None, ai_manager=None, **kwargs):
    """
    Engages in a context-aware conversation with a configured AI model.
    """
    if not ai_manager:
        return {
            "success": False,
            "error": {
                "message": "gemini: AI Manager is not available.",
                "suggestion": "This is an internal system error. Please try again later."
            }
        }

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
        return {
            "success": False,
            "error": {
                "message": "gemini: insufficient arguments.",
                "suggestion": "Try 'gemini \"<prompt>\"'."
            }
        }

    user_prompt = " ".join(args)

    result = await ai_manager.perform_agentic_search(user_prompt, [], provider, model, {"apiKey": api_key})

    if result["success"]:
        return {
            "effect": "display_prose",
            "header": "Gemini Response",
            "content": result.get("data")
        }
    else:
        return {
            "success": False,
            "error": {
                "message": "gemini: The AI agent failed to complete the request.",
                "suggestion": f"Reason: {result.get('error', 'Unknown error')}"
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    gemini - Engage in a context-aware conversation with a configured AI model.

SYNOPSIS
    gemini [OPTIONS] "<prompt>"

DESCRIPTION
    The gemini command sends a prompt to a configured AI model, acting as a powerful
    assistant capable of using system tools to answer questions about your files.

OPTIONS
    -c, --chat
        Open an interactive, graphical chat session.

    -p, --provider <name>
        Specify the AI provider to use (e.g., 'gemini', 'ollama'). Defaults to 'ollama'.

    -m, --model <name>
        Specify the exact model name to use for the chosen provider.

EXAMPLES
    gemini "summarize all the .txt files in my home directory"
    gemini -c
    gemini -p gemini "what is the purpose of the main.js file?"
"""

def help(args, flags, user_context, **kwargs):
    return 'Usage: gemini [-c] [OPTIONS] "<prompt>"'