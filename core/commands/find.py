# gem/core/commands/find.py
import os
import fnmatch
from filesystem import fs_manager

def run(args, flags, user_context, **kwargs):
    """
    Searches for files in a directory hierarchy.
    """
    if not args:
        return {"success": False, "error": "find: missing path specification"}

    # Separate paths from expression arguments
    paths = []
    expression_args = []
    for i, arg in enumerate(args):
        if arg.startswith('-'):
            expression_args = args[i:]
            break
        paths.append(arg)

    if not expression_args:
        expression_args = ['-print'] # Default action

    # --- Simplified Expression Parser (to be expanded later) ---
    predicates = []
    i = 0
    while i < len(expression_args):
        token = expression_args[i]
        if token == '-name':
            if i + 1 < len(expression_args):
                pattern = expression_args[i+1]
                predicates.append(lambda p, n: fnmatch.fnmatch(os.path.basename(p), pattern))
                i += 1
            else:
                return {"success": False, "error": f"find: missing argument to `{token}`"}
        elif token == '-type':
            if i + 1 < len(expression_args):
                type_char = expression_args[i+1]
                if type_char == 'f':
                    predicates.append(lambda p, n: n.get('type') == 'file')
                elif type_char == 'd':
                    predicates.append(lambda p, n: n.get('type') == 'directory')
                else:
                    return {"success": False, "error": f"find: unknown type '{type_char}'"}
                i += 1
            else:
                return {"success": False, "error": f"find: missing argument to `{token}`"}
        i += 1
    # --- End Simplified Parser ---

    output_lines = []

    def traverse(current_path):
        node = fs_manager.get_node(current_path)
        if not node:
            return

        # Check if the current node matches all predicates
        matches = all(p(current_path, node) for p in predicates)
        if matches:
            output_lines.append(current_path)

        # Recurse if it's a directory
        if node.get('type') == 'directory':
            for child_name in sorted(node.get('children', {}).keys()):
                child_path = fs_manager.get_absolute_path(os.path.join(current_path, child_name))
                traverse(child_path)

    for start_path in paths:
        traverse(fs_manager.get_absolute_path(start_path))

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    find - searches for files in a directory hierarchy.

SYNOPSIS
    find [path...] [expression]

DESCRIPTION
    Recursively searches a directory tree for files that match a given
    expression. This version supports basic expressions.

EXPRESSIONS:
    -name <pattern>     File name matches shell pattern (e.g., "*.txt").
    -type <f|d>         File is of type f (file) or d (directory).
"""