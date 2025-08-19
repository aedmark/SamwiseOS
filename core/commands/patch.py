# gem/core/commands/patch.py

import re
from filesystem import fs_manager

def _parse_patch(patch_content):
    """Parses a unified diff string into a list of hunk objects."""
    hunks = []
    current_hunk = None
    hunk_header_re = re.compile(r'^@@\s+-(\d+)(,(\d+))?\s+\+(\d+)(,(\d+))?\s+@@')

    for line in patch_content.splitlines():
        if line.startswith('---') or line.startswith('+++'):
            continue

        match = hunk_header_re.match(line)
        if match:
            if current_hunk:
                hunks.append(current_hunk)

            current_hunk = {
                'old_start': int(match.group(1)),
                'old_lines': int(match.group(3)) if match.group(3) else 1,
                'new_start': int(match.group(4)),
                'new_lines': int(match.group(6)) if match.group(6) else 1,
                'lines': []
            }
        elif current_hunk and (line.startswith('+') or line.startswith('-') or line.startswith(' ')):
            current_hunk['lines'].append(line)

    if current_hunk:
        hunks.append(current_hunk)
    return hunks

def _apply_patch(original_content, hunks):
    """Applies parsed hunks to the original content."""
    original_lines = original_content.splitlines()
    new_lines = list(original_lines)
    offset = 0

    for hunk in hunks:
        start_index = hunk['old_start'] - 1 + offset
        hunk_original_lines = [line[1:] for line in hunk['lines'] if not line.startswith('+')]
        lines_to_add = [line[1:] for line in hunk['lines'] if not line.startswith('-')]

        new_lines[start_index : start_index + len(hunk_original_lines)] = lines_to_add
        offset += len(lines_to_add) - len(hunk_original_lines)

    return '\n'.join(new_lines)


def run(args, flags, user_context, **kwargs):
    if len(args) != 2:
        return {
            "success": False,
            "error": {
                "message": "patch: missing operand",
                "suggestion": "Try 'patch <target_file> <patch_file>'."
            }
        }

    target_file_path, patch_file_path = args[0], args[1]

    target_node = fs_manager.get_node(target_file_path)
    if not target_node:
        return {
            "success": False,
            "error": {
                "message": f"patch: {target_file_path}: No such file or directory",
                "suggestion": "Please verify the target file path is correct."
            }
        }

    patch_node = fs_manager.get_node(patch_file_path)
    if not patch_node:
        return {
            "success": False,
            "error": {
                "message": f"patch: {patch_file_path}: No such file or directory",
                "suggestion": "Please verify the patch file path is correct."
            }
        }

    target_content = target_node.get('content', '')
    patch_content = patch_node.get('content', '')

    try:
        hunks = _parse_patch(patch_content)
        if not hunks and patch_content.strip():
            return {
                "success": False,
                "error": {
                    "message": "patch: unrecognized patch format",
                    "suggestion": "Ensure the patch file is in a standard unified diff format."
                }
            }

        if not hunks:
            return f"File '{target_file_path}' is already up to date."

        new_content = _apply_patch(target_content, hunks)

        fs_manager.write_file(target_file_path, new_content, user_context)
        return f"patching file {target_file_path}"
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "patch: an unexpected error occurred while applying the patch.",
                "suggestion": f"Details: {repr(e)}"
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
patch - apply a diff file to an original

SYNOPSIS
patch [ORIGINALFILE] [PATCHFILE]

DESCRIPTION
patch takes a patch file containing a difference listing produced
by the diff program and applies those differences to an original
file, producing a patched version.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: patch <target_file> <patch_file>"