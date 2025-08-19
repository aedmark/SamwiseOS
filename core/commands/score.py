# gemini/core/commands/score.py

import json
from filesystem import fs_manager

SCORE_PATH = "/var/log/scores.json"

def define_flags():
    """Declares the flags that the score command accepts."""
    return {'flags': [], 'metadata': {}}

def run(args, flags, user_context, **kwargs):
    """Displays the task completion scores for users."""
    if args:
        return {"success": False, "error": "score: command takes no arguments."}

    node = fs_manager.get_node(SCORE_PATH)
    if not node:
        return "No scores recorded yet. Complete a task with 'planner <proj> done <id>' to get started!"

    try:
        scores = json.loads(node.get('content', '{}'))
    except json.JSONDecodeError:
        return {"success": False, "error": "score: the score file is corrupted."}

    if not scores:
        return "No scores recorded yet."

    output = ["--- SamwiseOS Task Completion Scores ---"]
    sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)

    for user, score in sorted_scores:
        output.append(f"  {user.ljust(20)} {score} tasks completed")

    return "\n".join(output)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    score - Displays user productivity scores.

SYNOPSIS
    score

DESCRIPTION
    Displays a leaderboard of users based on the number of tasks they have
    completed using the 'planner' command. It's a fun way to track productivity!
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the score command."""
    return "Usage: score"