// scripts/commands/exit.js

/**
 * @fileoverview This file defines the 'exit' command, which is used to
 * terminate the current shell session or application.
 * @module commands/exit
 */

/**
 * Represents the 'exit' command.
 * @class ExitCommand
 * @extends Command
 */
window.ExitCommand = class ExitCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "exit",
            description: "Exits the current shell or application.",
            helpText: `Usage: exit
      Exits the current interactive shell session.
      DESCRIPTION
      In a normal shell, 'exit' behaves like the 'logout' command,
      ending the current user's session.
      When used inside a script or application like 'basic' or 'chidi',
      it will close the application and return to the shell.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'exit' command.
     * In the OopisOS simulation, this command functions as an alias for 'logout'
     * to provide a familiar command for ending sessions. It also provides a specific
     * message if used within the 'dreamatorium' sandboxed environment.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with the result of the logout command or a specific message.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;

        if (CommandExecutor.isInDreamatorium) {
            return ErrorHandler.createSuccess("You are in the Dreamatorium. Type 'exit' to return to reality.");
        }

        // In a real terminal, this would close the tab/window.
        // Here, it just acts as an alias for logout for the main shell.
        return CommandExecutor.processSingleCommand("logout", { isInteractive: true });
    }
}

window.CommandRegistry.register(new ExitCommand());