# gem/core/commands/tr.py

import string

def _expand_set(set_str):
    """Expands character sets like 'a-z' and '[:alpha:]' into a list of characters."""
    char_classes = {
        '[:alnum:]': string.ascii_letters + string.digits,
        '[:alpha:]': string.ascii_letters,
        '[:digit:]': string.digits,
        '[:lower:]': string.ascii_lowercase,
        '[:upper:]': string.ascii_uppercase,
        '[:space:]': string.whitespace,
        '[:punct:]': string.punctuation,
    }

    for cls, chars in char_classes.items():
        set_str = set_str.replace(cls, chars)

    expanded = []
    i = 0
    while i < len(set_str):
        if i + 1 < len(set_str) and set_str[i+1] == '-':
            if i + 2 < len(set_str):
                start = ord(set_str[i])
                end = ord(set_str[i+2])
                for j in range(start, end + 1):
                    expanded.append(chr(j))
                i += 3
            else:
                expanded.append(set_str[i])
                i += 1
        else:
            expanded.append(set_str[i])
            i += 1
    return expanded

def run(args, flags, user_context, stdin_data=None):
    if stdin_data is None:
        return ""

    if not args:
        return "tr: missing operand"

    set1_str = args[0]
    set2_str = args[1] if len(args) > 1 else None

    is_delete = '-d' in flags
    is_squeeze = '-s' in flags
    is_complement = '-c' in flags

    if is_complement:
        all_chars = [chr(i) for i in range(256)]
        original_set1 = set(_expand_set(set1_str))
        set1_str = "".join([c for c in all_chars if c not in original_set1])

    processed_content = stdin_data

    # Deletion or Translation
    if is_delete:
        if len(args) > 2 or (len(args) == 2 and not is_squeeze):
            return "tr: extra operand with -d"
        delete_set = set(_expand_set(set1_str))
        processed_content = "".join([c for c in processed_content if c not in delete_set])
    elif set2_str:
        set1 = _expand_set(set1_str)
        set2 = _expand_set(set2_str)

        translation_map = {}
        for i, char_s1 in enumerate(set1):
            translated_char = set2[i] if i < len(set2) else set2[-1]
            translation_map[char_s1] = translated_char

        processed_content = "".join([translation_map.get(c, c) for c in processed_content])

    # Squeezing
    if is_squeeze:
        squeeze_str = set2_str if is_delete and set2_str else (set2_str or set1_str)
        if not squeeze_str:
            return "tr: missing operand for -s"

        squeeze_set = set(_expand_set(squeeze_str))
        squeezed_result = ""
        last_char = None
        for char in processed_content:
            if char in squeeze_set:
                if char != last_char:
                    squeezed_result += char
            else:
                squeezed_result += char
            last_char = char
        processed_content = squeezed_result

    return processed_content

def man(args, flags, user_context, stdin_data=None):
    return """
NAME
    tr - translate, squeeze, and/or delete characters

SYNOPSIS
    tr [OPTION]... SET1 [SET2]

DESCRIPTION
    Translate, squeeze, and/or delete characters from standard input,
    writing to standard output.

    -c, --complement
          use the complement of SET1
    -d, --delete
          delete characters in SET1, do not translate
    -s, --squeeze-repeats
          replace each sequence of a repeated character in the last set
          with a single occurrence of that character
"""

def help(args, flags, user_context, stdin_data=None):
    return "Usage: tr [OPTION]... SET1 [SET2]"