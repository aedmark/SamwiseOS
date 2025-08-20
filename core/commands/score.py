# gemini/core/commands/score.py

import json
from filesystem import fs_manager

SCORE_PATH = "/var/log/scores.json"

def define_flags():
    return {'flags': [], 'metadata': {}}

def run(args, flags, user_context, **kwargs):
    """Displays the task completion scores for users."""
    if args:
        return {
            "success": False,
            "error": {
                "message": "score: command takes no arguments",
                "suggestion": "Simply run 'score' to see the leaderboard."
            }
        }

    node = fs_manager.get_node(SCORE_PATH)
    if not node:
        return "No scores recorded yet. Complete a task with 'planner <proj> done <id>' to get started!"

    try:
        scores = json.loads(node.get('content', '{}'))
    except json.JSONDecodeError:
        return {
            "success": False,
            "error": {
                "message": "score: the score file is corrupted",
                "suggestion": "The score file at /var/log/scores.json may need to be reset by an administrator."
            }
        }

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

OPTIONS
    This command takes no options.

EXAMPLES
    score
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: score"