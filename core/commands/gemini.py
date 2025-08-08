# gem/core/commands/gemini.py

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None, jobs=None, ai_manager=None):
    """
    Engages in a context-aware conversation with a configured AI model.
    """
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    if '--chat' in flags or '-c' in flags:
        # This effect will launch the existing JavaScript-based chat UI
        return {
            "effect": "launch_app",
            "app_name": "GeminiChat",
            "options": {
                "provider": flags.get('--provider') or flags.get('-p'),
                "model": flags.get('--model') or flags.get('-m')
            }
        }

    if not args:
        return {"success": False, "error": 'Insufficient arguments. Usage: gemini "<prompt>"'}

    user_prompt = " ".join(args)

    # For now, we'll just pass through. The real logic will be in AIManager.
    # We'll need to pass conversation history and other context from JS.
    result = ai_manager.perform_agentic_search(user_prompt, [], flags.get('--provider', 'gemini'), flags.get('--model'), {})

    if result["success"]:
        return result["data"]
    else:
        return result["error"]

def man(args, flags, user_context, **kwargs):
    return """
NAME
    gemini - Engages in a context-aware conversation with a configured AI model.

SYNOPSIS
    gemini [-c | --chat] [-p provider] [-m model] "<prompt>"

DESCRIPTION
    The gemini command sends a prompt to a configured AI model, acting as a powerful
    assistant capable of using system tools to answer questions about your files.
"""