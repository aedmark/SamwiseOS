# gem/core/commands/bc.py

import re
import operator
import math

# A simple, safe calculator for basic arithmetic.
def _safe_eval(expression):
    # Allow letters for functions, but still be very strict.
    clean_expr = re.sub(r'[^0-9\.\+\-\*\/\(\)\s\w]', '', expression)

    if not clean_expr:
        raise ValueError("Invalid expression")

    # A second pass to ensure no double underscores, which can access dangerous attributes.
    if '__' in clean_expr:
        raise ValueError("Invalid characters in expression")

    # Create a dictionary of safe functions from the math module
    safe_dict = {
        'sqrt': math.sqrt, 'pow': math.pow, 'sin': math.sin, 'cos': math.cos,
        'tan': math.tan, 'abs': abs, 'pi': math.pi, 'e': math.e,
        'log': math.log, 'log10': math.log10, 'ceil': math.ceil, 'floor': math.floor
    }

    # Using eval() here is safe because we provide a controlled global scope.
    # The second argument to eval ({}) makes the default builtins unavailable.
    return eval(clean_expr, {"__builtins__": {}}, safe_dict)

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
        return {
            "success": False,
            "error": {
                "message": "bc: division by zero",
                "suggestion": "You cannot divide a number by zero."
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": f"bc: error in expression: {repr(e)}",
                "suggestion": "Please check the syntax of your mathematical expression."
            }
        }

def man(args, flags, user_context, **kwargs):
    return """
NAME
    bc - An arbitrary precision calculator language

SYNOPSIS
    bc [expression]

DESCRIPTION
    bc is a basic calculator that evaluates a mathematical expression provided as an argument or from standard input. It supports basic arithmetic operations (+, -, *, /) and parentheses for grouping. It also supports several mathematical functions like sqrt(), pow(), sin(), etc.

EXAMPLES
    bc "10 / 2"
    echo "sqrt(16) * (2 + 2)" | bc
"""

def help(args, flags, user_context, **kwargs):
    """Provides help information for the bc command."""
    return "Usage: bc [expression]"