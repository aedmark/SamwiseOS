/**
 * @fileoverview This file defines the 'x' command, the primary launcher for the
 * OopisX Graphical Desktop Environment.
 * @module commands/x
 */

/**
 * Represents the 'x' command, which initializes the desktop environment.
 * @class XCommand
 * @extends Command
 */
window.XCommand = class XCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "x",
            dependencies: [
                "apps/desktop/desktop_ui.js",
                "apps/desktop/taskbar_ui.js",
                "apps/desktop/icon_ui.js",
                "apps/desktop/desktop_manager.js",
                "apps/desktop/taskbar_manager.js",
                "apps/desktop/window_manager.js",
                "apps/desktop/icon_manager.js",
                "apps/desktop/app_launcher.js",
            ],
            applicationModules: [
                "DesktopUI", "TaskbarUI", "IconUI",
                "TaskbarManager", "DesktopManager", "WindowManager",
                "IconManager", "AppLauncher", "App"
            ],
            description: "Initializes the OopisX Graphical Desktop Environment.",
            helpText: `Usage: x
      Initializes and displays the OopisX desktop environment, transitioning
      the session from a purely command-line interface to a graphical one.`,
            validations: { args: { exact: 0 } },
        });
    }

    /**
     * Executes the core logic of the 'x' command. It checks if the session is
     * interactive and if the required desktop modules are loaded, then launches
     * the DesktopManager to start the graphical user interface.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { options, dependencies } = context;
        const { ErrorHandler, AppLayerManager, DesktopManager } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError({ message: "x: Can only be run in an interactive session." });
        }

        if (typeof DesktopManager === "undefined" || typeof AppLayerManager === "undefined") {
            return ErrorHandler.createError({ message: "x: Desktop application module is not loaded." });
        }

        const desktopDependencies = {
            ...dependencies,
            DesktopUI: dependencies.DesktopUI,
            WindowManager: dependencies.WindowManager,
            TaskbarManager: dependencies.TaskbarManager,
            TaskbarUI: dependencies.TaskbarUI,
            IconManager: dependencies.IconManager,
            IconUI: dependencies.IconUI,
            AppLauncher: dependencies.AppLauncher,
        };

        AppLayerManager.show(new DesktopManager(), { dependencies: desktopDependencies });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new XCommand());