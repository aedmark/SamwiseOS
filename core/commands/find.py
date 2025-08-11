# gem/core/commands/find.py
import os
import fnmatch
import re
from filesystem import fs_manager

def _parse_expression(args):
    """
    Parses the find expression arguments into a structured list of predicates and actions.
    This is a more robust parser that handles operators like -o.
    """
    # This will be a list of lists. Each inner list is a group of ANDed predicates.
    # e.g., [ [pred1, pred2], [pred3] ] is (pred1 AND pred2) OR (pred3)
    predicate_groups = [[]]
    actions = []
    i = 0

    while i < len(args):
        token = args[i]

        if token == '-name':
            if i + 1 >= len(args): raise ValueError(f"missing argument to `-name`")
            pattern = args[i+1]
            predicate_groups[-1].append(lambda p, n: fnmatch.fnmatch(os.path.basename(p), pattern))
            i += 2
        elif token == '-type':
            if i + 1 >= len(args): raise ValueError(f"missing argument to `-type`")
            type_char = args[i+1]
            if type_char not in ['f', 'd']: raise ValueError(f"unknown type '{type_char}'")
            node_type = 'file' if type_char == 'f' else 'directory'
            predicate_groups[-1].append(lambda p, n: n.get('type') == node_type)
            i += 2
        elif token == '-perm':
            if i + 1 >= len(args): raise ValueError(f"missing argument to `-perm`")
            mode_str = args[i+1]
            if not re.match(r'^[0-7]{3,4}$', mode_str): raise ValueError(f"invalid mode '{mode_str}'")
            mode_octal = int(mode_str, 8)
            predicate_groups[-1].append(lambda p, n: (n.get('mode', 0) & 0o777) == mode_octal)
            i += 2
        elif token == '-o':
            # OR operator: starts a new group of ANDed predicates
            predicate_groups.append([])
            i += 1
        elif token == '-exec':
            command_parts = []
            i += 1
            while i < len(args):
                if args[i] == ';':
                    break
                command_parts.append(args[i])
                i += 1
            if not command_parts: raise ValueError("missing argument to `-exec`")
            actions.append({'type': 'exec', 'command': command_parts})
            i += 1
        elif token == '-delete':
            actions.append({'type': 'delete'})
            i += 1
        else:
            raise ValueError(f"unknown predicate `{token}`")

    if not actions:
        actions.append({'type': 'print'}) # Default action is to print the path

    return predicate_groups, actions

def run(args, flags, user_context, **kwargs):
    """
    Searches for files in a directory hierarchy with advanced expressions.
    """
    if not args:
        return {"success": False, "error": "find: missing path specification"}

    paths = []
    expression_args = []
    for i, arg in enumerate(args):
        if arg.startswith('-'):
            expression_args = args[i:]
            break
        paths.append(arg)

    if not paths: paths = ['.'] # Default path is current directory

    try:
        predicate_groups, actions = _parse_expression(expression_args)
    except ValueError as e:
        return {"success": False, "error": f"find: {e}"}

    output_lines = []
    commands_to_exec = []

    def traverse(current_path):
        node = fs_manager.get_node(current_path)
        if not node: return

        # Evaluate predicates: True if ANY group of ANDed predicates is true
        matches = any(
            all(p(current_path, node) for p in group)
            for group in predicate_groups if group
        )

        if matches:
            for action in actions:
                if action['type'] == 'print':
                    output_lines.append(current_path)
                elif action['type'] == 'delete':
                    try:
                        fs_manager.remove(current_path, recursive=(node.get('type') == 'directory'))
                    except Exception as e:
                        output_lines.append(f"find: cannot delete '{current_path}': {e}")
                elif action['type'] == 'exec':
                    cmd_str = ' '.join([
                        part.replace('{}', current_path) for part in action['command']
                    ])
                    commands_to_exec.append(cmd_str)

        if node.get('type') == 'directory':
            for child_name in sorted(node.get('children', {}).keys()):
                child_path = fs_manager.get_absolute_path(os.path.join(current_path, child_name))
                traverse(child_path)

    for start_path in paths:
        traverse(fs_manager.get_absolute_path(start_path))

    if commands_to_exec:
        return {
            "effect": "execute_commands",
            "commands": commands_to_exec,
            "output": "\n".join(output_lines)
        }

    return "\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    find - searches for files in a directory hierarchy.

SYNOPSIS
    find [path...] [expression]

DESCRIPTION
    Recursively searches a directory tree for files that match a given expression.

EXPRESSIONS:
    -name <pattern>     File name matches shell pattern (e.g., "*.txt").
    -type <f|d>         File is of type f (file) or d (directory).
    -perm <mode>        File's permission bits are exactly mode (octal).
    -o                  OR operator to combine expressions.
    -delete             Delete found files and directories.
    -exec <cmd> {} ;    Execute command on found file ({} is replaced by file path).
"""