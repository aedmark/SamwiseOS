# gem/core/commands/expr.py

import re
import operator

def run(args, flags, user_context, **kwargs):
    if not args:
        return {"success": False, "error": "expr: missing operand"}

    # Join all arguments into a single string to handle cases like '2000', '+', '25'
    expression = " ".join(args)

    # Tokenize the expression into numbers and operators
    tokens = re.findall(r'(\d+\.?\d*|\+|\-|\*|\/|\%|\(|\))', expression)

    # Basic validation to catch unsupported characters
    if "".join(tokens).replace(" ", "") != expression.replace(" ", ""):
        return {"success": False, "error": "expr: syntax error"}

    ops = {'+': operator.add, '-': operator.sub, '*': operator.mul, '/': operator.truediv, '%': operator.mod}
    precedence = {'+': 1, '-': 1, '*': 2, '/': 2, '%': 2}

    def apply_op(operators, values):
        """Applies an operator to the top two values on the stack."""
        try:
            op = operators.pop()
            right = values.pop()
            left = values.pop()
            if op == '/' and right == 0:
                raise ZeroDivisionError("division by zero")
            values.append(ops[op](left, right))
        except IndexError:
            raise ValueError("Invalid expression")

    values_stack = []
    ops_stack = []

    for token in tokens:
        if token.replace('.', '', 1).isdigit():
            values_stack.append(float(token))
        elif token == '(':
            ops_stack.append(token)
        elif token == ')':
            while ops_stack and ops_stack[-1] != '(':
                apply_op(ops_stack, values_stack)
            if not ops_stack or ops_stack.pop() != '(':
                return {"success": False, "error": "expr: mismatched parentheses"}
        elif token in ops:
            while (ops_stack and ops_stack[-1] in ops and
                   precedence.get(ops_stack[-1], 0) >= precedence.get(token, 0)):
                apply_op(ops_stack, values_stack)
            ops_stack.append(token)
        else:
            return {"success": False, "error": "expr: syntax error"}

    try:
        while ops_stack:
            apply_op(ops_stack, values_stack)
    except (ValueError, ZeroDivisionError) as e:
        return {"success": False, "error": f"expr: {e}"}


    if len(values_stack) != 1 or ops_stack:
        return {"success": False, "error": "expr: syntax error"}

    result = values_stack[0]
    if result == int(result):
        return str(int(result))
    return str(result)

def man(args, flags, user_context, **kwargs):
    return """
NAME
    expr - evaluate expressions

SYNOPSIS
    expr EXPRESSION

DESCRIPTION
    Print the value of EXPRESSION to standard output. Supports basic
    arithmetic operators: +, -, *, /, % and parentheses for grouping.
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: expr EXPRESSION"