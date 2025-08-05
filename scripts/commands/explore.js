// scripts/commands/explore.js

/**
 * @fileoverview This file defines the 'explore' command, which launches the OopisOS
 * graphical file explorer application.
 * @module commands/explore
 */

/**
 * Represents the 'explore' command for launching the graphical file explorer.
 * @class ExploreCommand
 * @extends Command
 */
window.ExploreCommand = class ExploreCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "explore",
            dependencies: [
                "apps/explorer/explorer_ui.js",
                "apps/explorer/explorer_manager.js",
            ],
            applicationModules: ["ExplorerManager", "ExplorerUI", "App"],
            description: "Opens the graphical file explorer.",
            helpText: `Usage: explore [path]
      Launches the graphical file explorer application.
      DESCRIPTION
      The explore command opens a two-pane graphical user interface for
      navigating the file system. The left pane shows a directory tree,
      and the right pane shows the contents of the selected directory.
      If an optional [path] is provided, the explorer will attempt to
      start at that location.
      Right-click on files, directories, or the pane background to access
      actions like creating, renaming, moving, and deleting items.`,
            completionType: "paths",
            validations: {
                args: {
                    max: 1,
                    error: "Usage: explore [path]"
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'explore' command.
     * It checks if the session is interactive, ensures the necessary application
     * modules are loaded, and then launches the ExplorerManager with an optional
     * starting path.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, options, dependencies } = context;
        const { ErrorHandler, AppLayerManager, ExplorerManager } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError({
                message: "explore: Can only be run in an interactive session."
            });
        }

        if (
            typeof ExplorerManager === "undefined" ||
            typeof AppLayerManager === "undefined"
        ) {
            return ErrorHandler.createError({
                message: "explore: Explorer application module is not loaded."
            });
        }

        const startPath = args.length > 0 ? args[0] : null;

        AppLayerManager.show(new ExplorerManager(), { startPath: startPath, dependencies: dependencies });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new ExploreCommand());