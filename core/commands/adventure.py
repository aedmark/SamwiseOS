# gem/core/commands/adventure.py
import json
from filesystem import fs_manager

# The default adventure is now enshrined in Python!
default_adventure_data = {
    "title": "The Architect's Apprentice", "startingRoomId": "test_chamber", "maxScore": 50,
    "winCondition": {"type": "itemUsedOn", "itemId": "page", "targetId": "terminal"},
    "winMessage": "You touch the manual page to the terminal's screen... The Architect smiles. 'Excellent work. Test complete.'",
    "rooms": {
        "test_chamber": {"id": "test_chamber", "name": "Test Chamber", "points": 0, "description": "You are in a room that feels... unfinished...", "exits": {"north": "server_closet"}},
        "server_closet": {"id": "server_closet", "name": "Server Closet", "description": "You have entered a small, dark closet.", "isDark": True, "exits": {"south": "test_chamber"}}
    },
    "items": {
        "desk": {"id": "desk", "name": "metal desk", "noun": "desk", "description": "A simple metal desk. A small, brass key rests on its surface.", "location": "test_chamber", "canTake": False},
        "key": {"id": "key", "name": "brass key", "noun": "key", "description": "A small, plain brass key.", "location": "test_chamber", "canTake": True, "unlocks": "chest", "points": 10},
        "chest": {"id": "chest", "name": "wooden chest", "noun": "chest", "description": "A sturdy wooden chest, firmly locked.", "location": "test_chamber", "canTake": False, "isOpenable": True, "isLocked": True, "isOpen": False, "isContainer": True, "contains": ["page"]},
        "page": {"id": "page", "name": "manual page", "noun": "page", "description": "A single page torn from a technical manual.", "location": "chest", "canTake": True, "points": 25},
        "terminal": {"id": "terminal", "name": "computer terminal", "noun": "terminal", "location": "test_chamber", "canTake": False, "state": "off", "descriptions": {"off": "A computer terminal with a blank, dark screen.", "on": "The terminal screen glows with a soft green light."}, "onUse": {"page": {"conditions": [{"itemId": "terminal", "requiredState": "on"}], "message": "", "failureMessage": "You touch the page to the dark screen, but nothing happens.", "destroyItem": True}}},
        "lantern": {"id": "lantern", "name": "old lantern", "noun": "lantern", "description": "An old-fashioned brass lantern.", "location": "server_closet", "canTake": True, "isLightSource": True, "isLit": False, "points": 5},
        "power_box": {"id": "power_box", "name": "power box", "noun": "box", "location": "server_closet", "canTake": False, "state": "off", "descriptions": {"off": "A heavy metal power box... lever is set to 'OFF'.", "on": "The lever on the power box is now in the 'ON' position."}, "onPush": {"newState": "on", "message": "You push the heavy lever... a light from the other room flickers.", "effects": [{"targetId": "terminal", "newState": "on"}]}}
    },
    "npcs": {
        "architect": {"id": "architect", "name": "The Architect", "noun": "architect", "description": "A shimmering, semi-transparent figure...", "location": "test_chamber", "dialogue": {"startNode": "start", "nodes": {"start": {"npcResponse": "'Welcome, apprentice. Your task is to find the Lost Manual Page and use it to compile the room correctly...'", "playerChoices": [{"keywords": ["understand"], "nextNode": "objective_understood"}, {"keywords": ["chamber"], "nextNode": "ask_about_chamber"}]}, "objective_understood": {"npcResponse": "'Excellent.'", "playerChoices": []}, "ask_about_chamber": {"npcResponse": "'Just a sandbox...'", "playerChoices": []}}}}
    }
}

def run(args, flags, user_context, **kwargs):
    if '--create' in flags:
        # The JS CommandExecutor needs to know how to get dependencies for this to work
        return {
            "effect": "launch_interactive_app",
            "app_name": "Adventure_create",
            "options": {
                "filename": args[0] if args else "new_adventure.json",
                "initialData": {} # Start with a blank slate
            }
        }

    # Play Mode
    adventure_to_load = None
    if args:
        file_path = args[0]
        node = fs_manager.get_node(file_path)
        if not node:
            return {"success": False, "error": f"adventure: {file_path}: No such file or directory"}
        if node.get('type') != 'file':
            return {"success": False, "error": f"adventure: {file_path}: is not a file"}
        try:
            adventure_to_load = json.loads(node.get('content', '{}'))
        except json.JSONDecodeError:
            return {"success": False, "error": f"adventure: Error parsing adventure file '{file_path}'"}
    else:
        adventure_to_load = default_adventure_data

    return {
        "effect": "launch_app",
        "app_name": "Adventure",
        "options": {
            "adventureData": adventure_to_load
        }
    }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    adventure - Starts an interactive text adventure game or creation tool.

SYNOPSIS
    adventure [--create] [path_to_game.json]

DESCRIPTION
    Launches the OopisOS interactive text adventure engine. If no file is
    provided, starts the default adventure. Use 'adventure --create' to
    enter the interactive adventure creation tool.
"""