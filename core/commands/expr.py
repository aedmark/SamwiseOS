# gem/core/commands/expr.py

import re
import operator
import json

def run(args, flags, user_context, **kwargs):
    """
    Evaluates an arithmetic expression, now with support for
    command substitution like $(...). It's a real go-getter!
    """
    from executor import command_executor

    if not args:
        return {"success": False, "error": "expr: missing operand"}

    # Let's check for any command substitutions and resolve them first.
    # This is like doing our prep work before a big town hall meeting!
    processed_args = []
    i = 0
    while i < len(args):
        arg = args[i]
        # Regex to find $(...) patterns. Super-focused!
        match = re.search(r'\$\((.*?)\)', arg)
        if match:
            # We found one! Time for some civic action.
            full_match = match.group(0)
            command_to_run = match.group(1)

            # We need to pass the full context to the executor, just like
            # passing the right binder to the right committee member.
            js_context_json = json.dumps({
                "user_context": user_context,
                "users": kwargs.get('users'),
                "user_groups": kwargs.get('user_groups'),
                "config": kwargs.get('config'),
                "groups": kwargs.get('groups'),
                "jobs": kwargs.get('jobs'),
                "api_key": kwargs.get('api_key'),
                "session_start_time": kwargs.get('session_start_time'),
                "session_stack": kwargs.get('session_stack')
            })

            # Execute the subcommand with the full power of our system!
            result_json = command_executor.execute(command_to_run, js_context_json)
            result = json.loads(result_json)

            if result.get("success"):
                # Replace the command with its successful output. Democracy in action!
                substitution_value = result.get("output", "").strip()
                # Important: what if the substitution is the whole argument?
                # Or just part of it? We must be precise.
                updated_arg = arg.replace(full_match, substitution_value)
                processed_args.append(updated_arg)
            else:
                # If the sub-process fails, the whole expression is invalid. That's just good governance.
                return {"success": False, "error": f"expr: command substitution failed: {result.get('error')}"}
        else:
            # No substitution? Just add the argument to our list.
            processed_args.append(arg)
        i += 1


    # Now we proceed with the simple, clean expression. Beautiful!
    expression = " ".join(processed_args)
    tokens = re.findall(r'(\d+\.?\d*|\+|\-|\*|\/|\%|\(|\))', expression)

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
    Now also supports command substitution, e.g., expr 1 + $(echo 2).
"""

def help(args, flags, user_context, **kwargs):
    return "Usage: expr EXPRESSION"