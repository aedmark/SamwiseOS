# gem/core/commands/bc.py

import re

# A simple, safe calculator for basic arithmetic.
def _safe_eval(expression):
    # Remove all characters that are not digits, operators, or parentheses
    clean_expr = re.sub(r'[^0-9\.\+\-\*\/\(\)\s]', '', expression)

    if not clean_expr:
        raise ValueError("Invalid expression")

    # A second pass to ensure safety after cleaning
    if re.search(r'[a-zA-Z_]', clean_expr):
        raise ValueError("Invalid characters in expression")

    # Using eval() here is now safe because we've heavily sanitized the input string.
    return eval(clean_expr)

def run(args, flags, user_context, stdin_data=None, **kwargs):
    expression = ""
    if stdin_data:
        expression = stdin_data
    elif args:
        expression = " ".join(args)
    else:
        return "" # No input

    if not expression.strip():
        return ""

    try:
        result = _safe_eval(expression)
        # Return as integer if it's a whole number
        if isinstance(result, float) and result.is_integer():
            return str(int(result))
        return str(result)
    except ZeroDivisionError:
        return {"success": False, "error": "bc: division by zero"}
    except Exception as e:
        return {"success": False, "error": f"bc: error in expression: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    bc - An arbitrary precision calculator language

SYNOPSIS
    bc [expression]

DESCRIPTION
    bc is a basic calculator. It supports basic arithmetic operations.
    If an expression is provided as an argument, it evaluates it.
    Otherwise, it reads from standard input.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: bc [expression]"