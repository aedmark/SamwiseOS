// scripts/commands/expr.js

/**
 * @fileoverview This file defines the 'expr' command, a utility for evaluating
 * simple mathematical expressions from the command line.
 * @module commands/expr
 */

/**
 * Represents the 'expr' command for evaluating mathematical expressions.
 * @class ExprCommand
 * @extends Command
 */
window.ExprCommand = class ExprCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "expr",
            description: "Evaluates a mathematical expression.",
            helpText: `Usage: expr <expression>
      Evaluates a mathematical expression and prints the result.
      DESCRIPTION
      The expr utility evaluates an integer expression and writes the
      result to the standard output. The expression can include the
      following operators: + - * / % ( )
      Each part of the expression should be a separate argument.
      EXAMPLES
      expr 10 + 10
      Displays "20".
      expr \\( 10 + 10 \\) \\* 2
      Displays "40". Note that parentheses and the multiplication
      operator must be escaped to prevent the shell from interpreting them.`,
            isInputStream: false,
        });
    }

    /**
     * Executes the core logic of the 'expr' command.
     * It joins the arguments into a single expression string and uses a
     * Function constructor to safely evaluate it, returning the result.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success object containing the result or an error object.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;

        const expression = args.join(" ");

        try {
            // Using the Function constructor is a safer way to evaluate a string
            // than eval(), as it does not have access to the surrounding scope.
            const result = new Function(`return ${expression}`)();
            if (typeof result !== 'number' || !isFinite(result)) {
                return ErrorHandler.createError({
                    message: `expr: invalid expression`
                });
            }
            return ErrorHandler.createSuccess(String(result));
        } catch (e) {
            return ErrorHandler.createError({
                message: `expr: invalid expression`
            });
        }
    }
}

window.CommandRegistry.register(new ExprCommand());