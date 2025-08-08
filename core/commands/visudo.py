# gem/core/commands/visudo.py

def run(args, flags, user_context):
    if user_context.get('name') != 'root':
        return {"success": False, "error": "visudo: you must be root to run this command."}

    if args:
        return {"success": False, "error": "visudo: command takes no arguments."}

    # This effect tells the JS CommandExecutor to launch the editor with a special save hook.
    # The actual editing and validation logic is handled by the JS EditCommand and SudoManager.
    return {
        "effect": "visudo"
    }