// scripts/commands/history.js

/**
 * @fileoverview This file defines the 'history' command, a utility for displaying
 * or clearing the user's command history for the current session.
 * @module commands/history
 */

/**
 * Represents the 'history' command.
 * @class HistoryCommand
 * @extends Command
 */
window.HistoryCommand = class HistoryCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "history",
            description: "Displays or clears the command history.",
            helpText: `Usage: history [-c]
      Display or clear the command history.
      DESCRIPTION
      The history command displays the list of previously executed
      commands from the current session, with each command prefixed
      by its history number.
      The command history can be navigated in the prompt using the
      up and down arrow keys.
      OPTIONS
      -c, --clear
      Clear the entire command history for the current session.`,
            flagDefinitions: [
                {
                    name: "clear",
                    short: "-c",
                    long: "--clear",
                },
            ],
        });
    }

    /**
     * Executes the core logic of the 'history' command.
     * It either clears the history if the '-c' flag is present, or it displays
     * the numbered list of all commands in the current session's history.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { flags, dependencies } = context;
        const { ErrorHandler, HistoryManager, Config } = dependencies;
        if (flags.clear) {
            HistoryManager.clearHistory();
            return ErrorHandler.createSuccess("Command history cleared.");
        }
        const history = HistoryManager.getFullHistory();
        if (history.length === 0)
            return ErrorHandler.createSuccess(
                Config.MESSAGES.NO_COMMANDS_IN_HISTORY
            );

        const output = history
            .map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`)
            .join("\n");
        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new HistoryCommand());