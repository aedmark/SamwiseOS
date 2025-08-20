# gem/core/commands/expr.py

import re
import operator

def run(args, flags, user_context, **kwargs):
    if not args:
        return {
            "success": False,
            "error": {
                "message": "expr: missing operand",
                "suggestion": "Try 'expr 1 + 1'."
            }
        }
    # Join all arguments into a single string to handle cases like '2000', '+', '25'
    expression = " ".join(args)

    # Tokenize the expression into numbers and operators
    tokens = re.findall(r'(\d+\.?\d*|\+|\-|\*|\/|\%|\(|\))', expression)

    # Basic validation to catch unsupported characters
    if "".join(tokens).replace(" ", "") != expression.replace(" ", ""):
        return {"success": False, "error": {"message": "expr: syntax error", "suggestion": "The expression contains unsupported characters."}}

    ops = {'+': operator.add, '-': operator.sub, '*': operator.mul, '/': operator.truediv, '%': operator.mod}
    precedence = {'+': 1, '-': 1, '*': 2, '/': 2, '%': 2}

    def apply_op(operators, values):
        """Applies an operator to the top two values on the stack."""
        if len(values) < 2:
            op_for_error = operators[-1] if operators else '?'
            raise ValueError(f"not enough operands for operator '{op_for_error}'")
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
                return {"success": False, "error": {"message": "expr: mismatched parentheses", "suggestion": "Ensure every opening parenthesis has a matching closing parenthesis."}}
        elif token in ops:
            while (ops_stack and ops_stack[-1] in ops and
                   precedence.get(ops_stack[-1], 0) >= precedence.get(token, 0)):
                apply_op(ops_stack, values_stack)
            ops_stack.append(token)
        else:
            return {"success": False, "error": {"message": "expr: syntax error", "suggestion": "The expression is not well-formed."}}

    try:
        while ops_stack:
            apply_op(ops_stack, values_stack)
    except (ValueError, ZeroDivisionError) as e:
        return {"success": False, "error": {"message": f"expr: {e}", "suggestion": "Please check your expression for errors like division by zero."}}


    if len(values_stack) != 1 or ops_stack:
        return {"success": False, "error": {"message": "expr: syntax error", "suggestion": "The expression could not be fully evaluated."}}

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
    Print the value of EXPRESSION to standard output. Supports basic arithmetic operators: +, -, *, /, % and parentheses for grouping. Each part of the expression must be separated by spaces.

OPTIONS
    This command takes no options.

EXAMPLES
    expr 10 + 3
    expr 5 \\* \\( 2 + 2 \\)
    expr 100 % 3
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: expr EXPRESSION"