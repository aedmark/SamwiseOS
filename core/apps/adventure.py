# gem/core/apps/adventure.py

import json
import random
import re

class AdventureManager:
    """Manages the state and logic for the text adventure game."""
    def __init__(self):
        self.state = {}
        # This will be populated with default verbs and can be extended by adventure data
        self.verbs = self._get_default_verbs()

    def _get_default_verbs(self):
        return {
            "look": {"action": "look", "aliases": ["l", "examine", "x", "look at", "look in", "look inside"]},
            "go": {"action": "go", "aliases": ["north", "south", "east", "west", "up", "down", "n", "s", "e", "w", "u", "d", "enter", "exit"]},
            "take": {"action": "take", "aliases": ["get", "grab", "pick up"]},
            "drop": {"action": "drop", "aliases": []},
            "use": {"action": "use", "aliases": []},
            "inventory": {"action": "inventory", "aliases": ["i", "inv"]},
            "help": {"action": "help", "aliases": ["?"]},
            "quit": {"action": "quit", "aliases": []},
            "talk": {"action": "talk", "aliases": ["talk to", "speak to", "speak with"]},
            "score": {"action": "score", "aliases": []},
            "wait": {"action": "wait", "aliases": ["z"]},
        }

    def initialize_state(self, adventure_data_json, scripting_context_json):
        adventure = json.loads(adventure_data_json)
        scripting_context = json.loads(scripting_context_json) if scripting_context_json else None

        starting_room = adventure.get("rooms", {}).get(adventure.get("startingRoomId"))
        initial_score = starting_room.get("points", 0) if starting_room else 0

        self.state = {
            "adventure": adventure,
            "player": {
                "currentLocation": adventure.get("startingRoomId"),
                "inventory": adventure.get("player", {}).get("inventory", []),
                "score": initial_score,
                "moves": 0,
            },
            "scriptingContext": scripting_context,
            "lastPlayerCommand": "",
        }

        # Merge adventure-specific verbs with defaults
        self.verbs.update(adventure.get("verbs", {}))

        return self.get_initial_ui_update()

    def get_initial_ui_update(self):
        """Returns the necessary data to render the initial game state."""
        room = self.state["adventure"]["rooms"].get(self.state["player"]["currentLocation"])
        if not room:
            return {"error": "You have fallen into the void."}

        # Initial room description and status
        outputs = []
        outputs.append({"type": "status", "roomName": room.get("name"), "score": self.state["player"]["score"], "moves": self.state["player"]["moves"]})
        outputs.append({"type": "output", "text": self._get_room_description(room), "styleClass": "room-desc"})

        return {"success": True, "updates": outputs}

    def _get_room_description(self, room):
        """Constructs the full description for a room."""
        desc = [room.get("description", "")]

        items_in_room = [item["name"] for item in self.state["adventure"].get("items", {}).values() if item.get("location") == room.get("id")]
        if items_in_room:
            desc.append("You see here: " + ", ".join(items_in_room) + ".")

        npcs_in_room = [npc["name"] for npc in self.state["adventure"].get("npcs", {}).values() if npc.get("location") == room.get("id")]
        if npcs_in_room:
            desc.append("You see " + ", ".join(npcs_in_room) + " here.")

        exits = list(room.get("exits", {}).keys())
        if exits:
            desc.append("Exits: " + ", ".join(exits) + ".")

        return "\n".join(desc)

    def process_command(self, command_text):
        """Processes a single player command."""
        self.state['player']['moves'] += 1

        # Simplified parser
        parts = command_text.lower().strip().split()
        verb_str = parts[0]
        noun_str = " ".join(parts[1:]) if len(parts) > 1 else ""

        action = self._find_action(verb_str)

        updates = []

        if not action:
            updates.append({"type": "output", "text": "I don't understand that verb.", "styleClass": "error"})
        else:
            handler_name = f"_handle_{action}"
            handler = getattr(self, handler_name, self._handle_unknown)
            result_updates = handler(noun_str, verb_str)
            updates.extend(result_updates)

        # Always add status update at the end
        room = self.state["adventure"]["rooms"].get(self.state["player"]["currentLocation"])
        updates.append({"type": "status", "roomName": room.get("name"), "score": self.state["player"]["score"], "moves": self.state["player"]["moves"]})

        return {"success": True, "updates": updates}

    def _find_action(self, verb_str):
        """Finds the action corresponding to a verb string."""
        for verb, data in self.verbs.items():
            if verb == verb_str or verb_str in data.get("aliases", []):
                return data.get("action")
        return None

    def _find_entity_in_scope(self, noun_str):
        """Finds an item or NPC in the player's inventory or current room by its noun."""
        current_location = self.state['player']['currentLocation']
        inventory = self.state['player']['inventory']

        # Check inventory first
        for item_id in inventory:
            item = self.state['adventure']['items'].get(item_id)
            if item and item.get('noun') == noun_str:
                return item, 'item'

        # Check items in the room
        for item_id, item in self.state['adventure']['items'].items():
            if item.get('location') == current_location and item.get('noun') == noun_str:
                return item, 'item'

        # Check NPCs in the room
        for npc_id, npc in self.state['adventure']['npcs'].items():
            if npc.get('location') == current_location and npc.get('noun') == noun_str:
                return npc, 'npc'

        return None, None

    def _handle_look(self, noun_str, verb_str):
        if not noun_str:
            room = self.state["adventure"]["rooms"].get(self.state["player"]["currentLocation"])
            return [{"type": "output", "text": self._get_room_description(room), "styleClass": "room-desc"}]
        else:
            entity, entity_type = self._find_entity_in_scope(noun_str)
            if entity:
                return [{"type": "output", "text": entity.get("description", "You see nothing special."), "styleClass": "system"}]
            return [{"type": "output", "text": "You don't see that here.", "styleClass": "error"}]

    def _handle_go(self, noun_str, verb_str):
        direction = noun_str or verb_str
        room = self.state["adventure"]["rooms"].get(self.state["player"]["currentLocation"])
        exits = room.get("exits", {})

        if direction in exits:
            new_room_id = exits[direction]
            self.state['player']['currentLocation'] = new_room_id
            new_room = self.state['adventure']['rooms'].get(new_room_id)
            return [{"type": "output", "text": self._get_room_description(new_room), "styleClass": "room-desc"}]
        return [{"type": "output", "text": "You can't go that way.", "styleClass": "error"}]

    def _handle_take(self, noun_str, verb_str):
        if not noun_str:
            return [{"type": "output", "text": "Take what?", "styleClass": "error"}]

        entity, entity_type = self._find_entity_in_scope(noun_str)

        if entity_type == 'item' and entity.get('location') == self.state['player']['currentLocation']:
            if entity.get('canTake', False):
                entity['location'] = 'inventory'
                self.state['player']['inventory'].append(entity['id'])
                if entity.get('points'):
                    self.state['player']['score'] += entity.get('points', 0)
                return [{"type": "output", "text": f"You take the {entity['name']}.", "styleClass": "system"}]
            else:
                return [{"type": "output", "text": "You can't take that.", "styleClass": "error"}]

        return [{"type": "output", "text": "You don't see that here.", "styleClass": "error"}]

    def _handle_inventory(self, noun_str, verb_str):
        inventory_ids = self.state['player']['inventory']
        if not inventory_ids:
            return [{"type": "output", "text": "You are not carrying anything.", "styleClass": "system"}]

        item_names = [self.state['adventure']['items'][item_id]['name'] for item_id in inventory_ids]
        return [{"type": "output", "text": "You are carrying:\n" + "\n".join(item_names), "styleClass": "system"}]

    def _handle_unknown(self, noun_str, verb_str):
        return [{"type": "output", "text": "That's not a verb I recognize.", "styleClass": "error"}]

adventure_manager = AdventureManager()