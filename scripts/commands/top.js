/**
 * @fileoverview This file defines the 'top' command, which launches a full-screen
 * application to display a real-time view of running background processes.
 * @module commands/top
 */

/**
 * Represents the 'top' command for launching the process viewer application.
 * @class TopCommand
 * @extends Command
 */
window.TopCommand = class TopCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "top",
            dependencies: [
                "apps/top/top_ui.js",
                "apps/top/top_manager.js",
            ],
            applicationModules: ["TopManager", "TopUI", "App"],
            description: "Displays a real-time view of running processes.",
            helpText: `Usage: top
      Provides a dynamic, real-time view of the processes running in OopisOS.
      DESCRIPTION
      The top command opens a full-screen application that lists all active
      background jobs and system processes. The list is updated in real-time
      every second.
      KEYBOARD SHORTCUTS
      q - Quit the application.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'top' command. In an interactive session,
     * it launches the TopManager application, which provides a dynamic view of
     * running processes. In a non-interactive context, it returns a promise
     * that can be aborted, as the graphical application cannot be displayed.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { options, signal, dependencies } = context;
        const { ErrorHandler, AppLayerManager, TopManager } = dependencies;

        if (
            typeof TopManager === "undefined" ||
            typeof AppLayerManager === "undefined"
        ) {
            return ErrorHandler.createError({ message: "top: Top application module is not loaded." });
        }

        if (options.isInteractive) {
            AppLayerManager.show(new TopManager(), { dependencies });
            return ErrorHandler.createSuccess("");
        } else {
            return new Promise((_resolve, reject) => {
                if (signal) {
                    signal.addEventListener('abort', () => {
                        reject(new Error(`Operation cancelled. (Reason: ${signal.reason})`));
                    });
                }
            });
        }
    }
}

window.CommandRegistry.register(new TopCommand());