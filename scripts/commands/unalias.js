/**
 * @fileoverview This file defines the 'unalias' command, a utility for
 * removing previously defined command aliases from the current session.
 * @module commands/unalias
 */

/**
 * Represents the 'unalias' command.
 * @class UnaliasCommand
 * @extends Command
 */
window.UnaliasCommand = class UnaliasCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "unalias",
            description: "Removes one or more defined aliases.",
            helpText: `Usage: unalias <alias_name>...
      Remove aliases from the set of defined aliases.
      DESCRIPTION
      The unalias command is used to remove one or more specified
      aliases. Once unaliased, the shortcut will no longer be available.
      EXAMPLES
      unalias ll
      Removes the 'll' alias.
      unalias mypath mycommand
      Removes both the 'mypath' and 'mycommand' aliases.`,
            completionType: "aliases",
            argValidation: {
                min: 1,
                error: "Usage: unalias <alias_name>...",
            },
        });
    }

    /**
     * Executes the core logic of the 'unalias' command. It iterates through
     * the provided alias names, attempts to remove each one using the
     * AliasManager, and reports any errors if an alias does not exist.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { AliasManager, ErrorHandler } = dependencies;

        let allSuccess = true;
        const errorMessages = [];
        let changesMade = false;

        for (const aliasName of args) {
            if (AliasManager.removeAlias(aliasName)) {
                changesMade = true;
            } else {
                allSuccess = false;
                errorMessages.push(`unalias: no such alias: ${aliasName}`);
            }
        }

        if (allSuccess) {
            return ErrorHandler.createSuccess("", { stateModified: changesMade });
        } else {
            return ErrorHandler.createError({
                message: errorMessages.join("\n"),
                suggestion: "Run 'alias' to see the list of currently defined aliases.",
            });
        }
    }
}

window.CommandRegistry.register(new UnaliasCommand());