# gem/core/commands/find.py
import os
import fnmatch
import re
from filesystem import fs_manager

def _parse_expression(args):
    """
    Parses the find expression arguments into a structured list of predicates and actions.
    """
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
        actions.append({'type': 'print'})

    return predicate_groups, actions

def run(args, flags, user_context, **kwargs):
    """
    Searches for files in a directory hierarchy with advanced expressions.
    """
    if not args:
        return {
            "success": False,
            "error": {
                "message": "find: missing path specification",
                "suggestion": "Try 'find . -name \"*.txt\"'."
            }
        }

    paths = []
    expression_args = []
    for i, arg in enumerate(args):
        if arg.startswith('-'):
            expression_args = args[i:]
            break
        paths.append(arg)

    if not paths: paths = ['.']

    try:
        predicate_groups, actions = _parse_expression(expression_args)
    except ValueError as e:
        return {
            "success": False,
            "error": {
                "message": f"find: invalid expression: {e}",
                "suggestion": "Check the syntax of your expression. See 'man find' for help."
            }
        }

    output_lines = []
    commands_to_exec = []

    def traverse(current_path):
        node = fs_manager.get_node(current_path)
        if not node: return

        matches = any(
            all(p(current_path, node) for p in group)
            for group in predicate_groups if group
        ) if any(predicate_groups) else True

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
            "output": "\\n".join(output_lines)
        }

    return "\\n".join(output_lines)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    find - search for files in a directory hierarchy

SYNOPSIS
    find [path...] [expression]

DESCRIPTION
    The find utility recursively descends the directory tree for each path, evaluating an expression for each file.

OPTIONS
    -name <pattern>
        File name matches shell pattern (e.g., "*.txt").

    -type <f|d>
        File is of type f (file) or d (directory).

    -perm <mode>
        File's permission bits are exactly mode (octal).

    -o
        OR; the preceding expression is logically OR'd with the following one.

    -delete
        Delete found files and directories. This is an action and implies printing.

    -exec <cmd> {} ;
        Execute command on found file. The '{}' is replaced by the current file path. The command must end with a ';'. This is an action.

EXAMPLES
    find . -name "*.log"
    find /home -type d
    find . -name "*.tmp" -delete
    find . -name "*.txt" -exec cat {} ;
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: find [path...] [expression]"