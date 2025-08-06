# gem/core/commands/expr.py

import re

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    if not args:
        return "expr: missing operand"

    # Join all arguments into a single string to evaluate
    expression = " ".join(args)

    # Basic security: only allow digits, spaces, and simple math operators
    if not re.match(r'^[\d\s\+\-\*\/\(\)]+$', expression):
        return "expr: syntax error"

    try:
        # For safety, we use a custom, limited evaluation instead of eval()
        # This is a simple implementation that handles basic arithmetic.
        # A full implementation would use a proper parser.

        # This is a very basic way to handle order of operations.
        # It's not perfect but handles simple cases found in scripts.
        if '*' in expression or '/' in expression:
            # Simple left-to-right evaluation for multiplication/division
            parts = re.split(r'([\*\/\+\-])', expression)
            while '*' in parts or '/' in parts:
                for i, part in enumerate(parts):
                    if part == '*':
                        res = float(parts[i-1]) * float(parts[i+1])
                        parts = parts[:i-1] + [str(res)] + parts[i+2:]
                        break
                    if part == '/':
                        if float(parts[i+1]) == 0:
                            return "expr: division by zero"
                        res = float(parts[i-1]) / float(parts[i+1])
                        parts = parts[:i-1] + [str(res)] + parts[i+2:]
                        break
            expression = "".join(parts)

        # Now handle addition/subtraction
        parts = re.split(r'([\+\-])', expression)
        result = float(parts[0])
        for i in range(1, len(parts), 2):
            op = parts[i]
            num = float(parts[i+1])
            if op == '+':
                result += num
            elif op == '-':
                result -= num

        # Return integer if it's a whole number
        if result == int(result):
            return str(int(result))
        return str(result)

    except (ValueError, IndexError):
        return "expr: syntax error"
    except Exception as e:
        return f"expr: an error occurred: {repr(e)}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    expr - evaluate expressions

SYNOPSIS
    expr EXPRESSION

DESCRIPTION
    Print the value of EXPRESSION to standard output.
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: expr EXPRESSION"