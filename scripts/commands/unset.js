/**
 * @fileoverview This file defines the 'unset' command, a utility for
 * removing environment variables from the current shell session.
 * @module commands/unset
 */

/**
 * Represents the 'unset' command for removing environment variables.
 * @class UnsetCommand
 * @extends Command
 */
window.UnsetCommand = class UnsetCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "unset",
            description: "Unsets one or more shell environment variables.",
            helpText: `Usage: unset <variable_name>...
      Unset environment variables.
      DESCRIPTION
      The unset command removes the specified environment variable(s).
      Once unset, a variable will no longer be available to commands
      or for expansion.
      EXAMPLES
      set MY_VAR="some value"
      unset MY_VAR
      echo $MY_VAR (will print an empty line)`,
            validations: {
                args: {
                    min: 1,
                    error: "Usage: unset <variable_name>..."
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'unset' command. It iterates through
     * the provided variable names and removes each one from the current
     * environment using the EnvironmentManager.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { EnvironmentManager, ErrorHandler } = dependencies;

        for (const varName of args) {
            EnvironmentManager.unset(varName);
        }

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new UnsetCommand());