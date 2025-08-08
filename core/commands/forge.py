# gem/core/commands/forge.py

import shlex
from filesystem import fs_manager

def run(args, flags, user_context, api_key=None, ai_manager=None, **kwargs):
    if not ai_manager:
        return {"success": False, "error": "AI Manager is not available."}

    if not 1 <= len(args) <= 2:
        return {"success": False, "error": "Usage: forge \"<description>\" [output_file]"}

    description = args[0]
    output_file = args[1] if len(args) > 1 else None

    provider = flags.get("-p") or flags.get("--provider") or "gemini"
    model = flags.get("-m") or flags.get("--model")

    result = ai_manager.perform_forge(description, provider, model, api_key)

    if not result.get("success"):
        return {"success": False, "error": f"forge: The AI failed to generate the file. Reason: {result.get('error')}"}

    generated_content = result.get("data", "").strip()

    if output_file:
        try:
            fs_manager.write_file(output_file, generated_content, user_context)

            if output_file.endswith('.sh'):
                # Return an effect to make the script executable
                chmod_command = f"chmod 755 {shlex.quote(output_file)}"
                return {
                    "effect": "execute_commands",
                    "commands": [chmod_command],
                    "output": f"File '{output_file}' forged and made executable."
                }

            return {"success": True, "output": f"File '{output_file}' forged successfully."}
        except Exception as e:
            return {"success": False, "error": f"forge: Failed to write file: {repr(e)}"}
    else:
        # If no output file, print content to stdout
        return {"success": True, "output": generated_content}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    forge - AI-powered scaffolding and boilerplate generation tool.

SYNOPSIS
    forge [OPTIONS] "<description>" [output_file]

DESCRIPTION
    Generate file content using an AI model based on a description. If an
    output_file is specified, the content is saved. If no output file is
    provided, the content is printed to standard output.
"""