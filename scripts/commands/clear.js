/**
 * @file scripts/commands/clear.js
 * @description The 'clear' command, which clears all visible output from the terminal screen,
 * providing a fresh prompt at the top.
 */

/**
 * Represents the 'clear' command.
 * @class ClearCommand
 * @extends Command
 */
window.ClearCommand = class ClearCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "clear",
            description: "Clears the terminal screen of all previous output.",
            helpText: `Usage: clear
      Clear the terminal screen.
      DESCRIPTION
      The clear command clears your screen, removing all previous output
      and moving the command prompt to the top of the visible area.
      This does not clear your command history, which can still be
      accessed with the up and down arrow keys. To clear history, use
      the 'history -c' command.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Main logic for the 'clear' command.
     * In an interactive session, it returns a success object with a special 'clear_screen'
     * effect that the CommandExecutor will interpret to clear the UI.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { ErrorHandler } = dependencies;
        if (context.options.isInteractive) {
            return ErrorHandler.createSuccess(null, { effect: "clear_screen" });
        }
        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new ClearCommand());