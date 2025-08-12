# gem/core/commands/tr.py

import string

def define_flags():
    """Declares the flags that the tr command accepts."""
    return [
        {'name': 'complement', 'short': 'c', 'long': 'complement', 'takes_value': False},
        {'name': 'delete', 'short': 'd', 'long': 'delete', 'takes_value': False},
        {'name': 'squeeze-repeats', 'short': 's', 'long': 'squeeze-repeats', 'takes_value': False},
    ]

def _expand_set(set_str):
    """Expands character sets like 'a-z' and '[:alpha:]' into a list of characters."""
    char_classes = {
        '[:alnum:]': string.ascii_letters + string.digits, '[:alpha:]': string.ascii_letters,
        '[:digit:]': string.digits, '[:lower:]': string.ascii_lowercase,
        '[:upper:]': string.ascii_uppercase, '[:space:]': string.whitespace,
        '[:punct:]': string.punctuation,
    }
    for cls, chars in char_classes.items():
        set_str = set_str.replace(cls, chars)

    expanded, i = [], 0
    while i < len(set_str):
        if i + 2 < len(set_str) and set_str[i+1] == '-':
            start, end = ord(set_str[i]), ord(set_str[i+2])
            for j in range(start, end + 1):
                expanded.append(chr(j))
            i += 3
        else:
            expanded.append(set_str[i])
            i += 1
    return expanded

def run(args, flags, user_context, stdin_data=None):
    if stdin_data is None: return ""
    if not args: return {"success": False, "error": "tr: missing operand"}

    set1_str = args[0]
    set2_str = args[1] if len(args) > 1 else None

    is_delete, is_squeeze, is_complement = flags.get('delete', False), flags.get('squeeze-repeats', False), flags.get('complement', False)

    if is_complement:
        all_chars = [chr(i) for i in range(256)]
        original_set1 = set(_expand_set(set1_str))
        set1_str = "".join([c for c in all_chars if c not in original_set1])

    content = stdin_data
    if is_delete:
        if len(args) > 2 or (len(args) == 2 and not is_squeeze):
            return {"success": False, "error": "tr: extra operand with -d"}
        delete_set = set(_expand_set(set1_str))
        content = "".join([c for c in content if c not in delete_set])
    elif set2_str:
        set1, set2 = _expand_set(set1_str), _expand_set(set2_str)
        translation_map = {set1[i]: (set2[i] if i < len(set2) else set2[-1]) for i in range(len(set1))}
        content = "".join([translation_map.get(c, c) for c in content])

    if is_squeeze:
        squeeze_str = set2_str if is_delete and set2_str else (set2_str or set1_str)
        if not squeeze_str: return {"success": False, "error": "tr: missing operand for -s"}
        squeeze_set, squeezed_result, last_char = set(_expand_set(squeeze_str)), "", None
        for char in content:
            if not (char in squeeze_set and char == last_char):
                squeezed_result += char
            last_char = char
        content = squeezed_result

    return content

def man(args, flags, user_context, **kwargs):
    return """
NAME
    tr - translate, squeeze, and/or delete characters

SYNOPSIS
    tr [OPTION]... SET1 [SET2]

DESCRIPTION
    Translate, squeeze, and/or delete characters from standard input.

    -c, --complement
          use the complement of SET1
    -d, --delete
          delete characters in SET1, do not translate
    -s, --squeeze-repeats
          replace each sequence of a repeated character with a single occurrence
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: tr [OPTION]... SET1 [SET2]"