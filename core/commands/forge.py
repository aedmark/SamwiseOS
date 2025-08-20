# gem/core/commands/forge.py

import shlex
from filesystem import fs_manager

def define_flags():
    """Declares the flags that the forge command accepts."""
    return {
        'flags': [
            {'name': 'provider', 'short': 'p', 'long': 'provider', 'takes_value': True},
            {'name': 'model', 'short': 'm', 'long': 'model', 'takes_value': True},
        ],
        'metadata': {}
    }

async def run(args, flags, user_context, api_key=None, ai_manager=None, **kwargs):
    if not ai_manager:
        return {
            "success": False,
            "error": {
                "message": "forge: AI Manager is not available.",
                "suggestion": "This is an internal system error. Please check the system configuration."
            }
        }

    if not 1 <= len(args) <= 2:
        return {
            "success": False,
            "error": {
                "message": "forge: incorrect number of arguments.",
                "suggestion": "Try 'forge \"<description>\" [output_file]'."
            }
        }

    description = args[0]
    output_file = args[1] if len(args) > 1 else None

    provider = flags.get("provider") or "ollama"
    model = flags.get("model")

    result = await ai_manager.perform_forge(description, provider, model, api_key)

    if not result.get("success"):
        return {
            "success": False,
            "error": {
                "message": "forge: The AI failed to generate the file.",
                "suggestion": f"Reason: {result.get('error', 'Unknown AI error')}"
            }
        }

    generated_content = result.get("data", "").strip()

    if output_file:
        try:
            fs_manager.write_file(output_file, generated_content, user_context)

            if output_file.endswith('.sh'):
                chmod_command = f"chmod 755 {shlex.quote(output_file)}"
                return {
                    "effect": "execute_commands",
                    "commands": [chmod_command],
                    "output": f"File '{output_file}' forged and made executable."
                }

            return {"success": True, "output": f"File '{output_file}' forged successfully."}
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "message": f"forge: Failed to write to file '{output_file}'.",
                    "suggestion": f"Please check your permissions. Details: {repr(e)}"
                }
            }
    else:
        return {"success": True, "output": generated_content}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    forge - AI-powered scaffolding and boilerplate generation tool.

SYNOPSIS
    forge [OPTIONS] "<description>" [output_file]

DESCRIPTION
    Generate file content using an AI model based on a detailed description. If an output_file is specified, the content is saved to that file. If no output file is provided, the generated content is printed to standard output.

OPTIONS
    -p, --provider <name>
        Specify the AI provider to use (e.g., 'gemini', 'ollama'). Defaults to 'ollama'.
    -m, --model <name>
        Specify the exact model name to use for the chosen provider.

EXAMPLES
    forge "a simple python flask server" server.py
    forge "a professional README for a javascript project"
"""

def help(args, flags, user_context, **kwargs):
    return 'Usage: forge [OPTIONS] "<description>" [output_file]'