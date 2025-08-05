/**
 * @file scripts/commands/bc.js
 * @description The 'bc' command, a simple command-line calculator that evaluates mathematical expressions.
 * This implementation uses the Shunting-yard algorithm for safe expression evaluation.
 */

/**
 * Represents the 'bc' command, an arbitrary-precision calculator language.
 * @class BcCommand
 * @extends Command
 */
window.BcCommand = class BcCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "bc",
      description: "An arbitrary-precision calculator language.",
      helpText: `Usage: echo "<expression>" | bc
       bc "<expression>"

A simple, command-line calculator.

DESCRIPTION
       bc is a utility that evaluates mathematical expressions from either
       standard input (via a pipe) or from a string argument. It can handle
       integers and floating-point numbers, basic arithmetic (+, -, *, /, %),
       and parentheses for order of operations.

EXAMPLES
       echo "5 * (3 + 2)" | bc
              Calculates 5 times the sum of 3 and 2, outputting 25.

       bc "100 / 4"
              Calculates 100 divided by 4, outputting 25.`,
      isInputStream: true,
    });
  }

  /**
   * Safely evaluates a mathematical expression using the Shunting-yard algorithm
   * to handle order of operations. This prevents the use of `eval()`.
   * @private
   * @param {string} expression - The mathematical expression to evaluate.
   * @returns {number} The result of the calculation.
   * @throws {Error} If the expression is invalid.
   */
  _safeEvaluate(expression) {
    const cleanExpression = expression.replace(/\s+/g, "");

    const tokens = cleanExpression.match(/(\d+\.?\d*|\+|-|\*|\/|%|\(|\))/g);

    if (!tokens || tokens.join("") !== cleanExpression) {
      throw new Error("Invalid characters in expression.");
    }

    const outputQueue = [];
    const operatorStack = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
    const associativity = { "+": "L", "-": "L", "*": "L", "/": "L", "%": "L" };

    const applyOperator = () => {
      const operator = operatorStack.pop();
      const right = outputQueue.pop();
      const left = outputQueue.pop();
      if (left === undefined || right === undefined) {
        throw new Error("Syntax error.");
      }
      switch (operator) {
        case "+":
          outputQueue.push(left + right);
          break;
        case "-":
          outputQueue.push(left - right);
          break;
        case "*":
          outputQueue.push(left * right);
          break;
        case "/":
          if (right === 0) throw new Error("Division by zero.");
          outputQueue.push(left / right);
          break;
        case "%":
          if (right === 0) throw new Error("Division by zero.");
          outputQueue.push(left % right);
          break;
      }
    };

    for (const token of tokens) {
      if (!isNaN(parseFloat(token))) {
        outputQueue.push(parseFloat(token));
      } else if (token in precedence) {
        while (
            operatorStack.length > 0 &&
            operatorStack[operatorStack.length - 1] !== "(" &&
            (precedence[operatorStack[operatorStack.length - 1]] >
                precedence[token] ||
                (precedence[operatorStack[operatorStack.length - 1]] ===
                    precedence[token] &&
                    associativity[token] === "L"))
            ) {
          applyOperator();
        }
        operatorStack.push(token);
      } else if (token === "(") {
        operatorStack.push(token);
      } else if (token === ")") {
        while (
            operatorStack.length > 0 &&
            operatorStack[operatorStack.length - 1] !== "("
            ) {
          applyOperator();
        }
        if (operatorStack[operatorStack.length - 1] !== "(")
          throw new Error("Mismatched parentheses.");
        operatorStack.pop();
      }
    }

    while (operatorStack.length > 0) {
      if (operatorStack[operatorStack.length - 1] === "(")
        throw new Error("Mismatched parentheses.");
      applyOperator();
    }

    if (outputQueue.length !== 1) throw new Error("Invalid expression format.");
    return outputQueue[0];
  }

  /**
   * Main logic for the 'bc' command.
   * Takes an expression from arguments or stdin and uses the safe evaluator to compute the result.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} The result of the command execution.
   */
  async coreLogic(context) {
    const { args, options, dependencies } = context;
    const { ErrorHandler } = dependencies;
    let input = "";

    try {
      if (
          options.stdinContent !== null &&
          options.stdinContent !== undefined
      ) {
        input = options.stdinContent;
      } else if (args.length > 0) {
        input = args.join(" ");
      }

      if (!input.trim()) {
        return ErrorHandler.createSuccess("");
      }

      const result = this._safeEvaluate(input);
      return ErrorHandler.createSuccess(String(result));
    } catch (e) {
      return ErrorHandler.createError(`bc: ${e.message}`);
    }
  }
}

window.CommandRegistry.register(new BcCommand());