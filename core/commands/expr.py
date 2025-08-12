# gem/core/commands/expr.py

import re

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "expr: missing operand"}

    expression = " ".join(args)

    if not re.match(r'^[\d\s\+\-\*\/\(\)\%\.]+$', expression):
        return {"success": False, "error": "expr: syntax error"}

    try:
        # Simple left-to-right evaluation for multiplication/division/modulo
        parts = re.split(r'([\*\/\%])', expression)
        while len(parts) > 1:
            i = 1
            while i < len(parts):
                op = parts[i]
                if op in ['*', '/', '%']:
                    try:
                        left = float(parts[i-1])
                        right = float(parts[i+1])
                        res = 0
                        if op == '*':
                            res = left * right
                        elif op == '/':
                            if right == 0:
                                return {"success": False, "error": "expr: division by zero"}
                            res = left / right
                        elif op == '%':
                            res = left % right
                        parts = parts[:i-1] + [str(res)] + parts[i+2:]
                        i = 1 # restart scan
                    except (ValueError, IndexError):
                        return {"success": False, "error": "expr: syntax error"}
                else:
                    i += 2
            break # No more mul/div/mod operators

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

        if result == int(result):
            return str(int(result))
        return str(result)

    except (ValueError, IndexError):
        return {"success": False, "error": "expr: syntax error"}
    except Exception as e:
        return {"success": False, "error": f"expr: an error occurred: {repr(e)}"}

def man(args, flags, user_context, **kwargs):
    return """
NAME
    expr - evaluate expressions

SYNOPSIS
    expr EXPRESSION

DESCRIPTION
    Print the value of EXPRESSION to standard output. Supports basic
    arithmetic operators: +, -, *, /, %
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: expr EXPRESSION"