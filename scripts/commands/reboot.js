// scripts/commands/reboot.js

/**
 * @fileoverview This file defines the 'reboot' command, a utility for safely
 * reloading the entire OopisOS virtual machine by refreshing the browser page.
 * @module commands/reboot
 */

/**
 * Represents the 'reboot' command.
 * @class RebootCommand
 * @extends Command
 */
window.RebootCommand = class RebootCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "reboot",
            description: "Reboots the OopisOS virtual machine.",
            helpText: `Usage: reboot
      Reboot the OopisOS virtual machine.
      DESCRIPTION
      The reboot command safely reloads the OopisOS environment by
      reloading the browser page.
      Because all user data, files, and session information are saved
      to persistent browser storage, your entire system state will be
      preserved and restored after the reboot is complete. This is
      useful for applying certain configuration changes or recovering
      from a UI glitch.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'reboot' command.
     * It displays a reboot message and then triggers a page reload,
     * effectively restarting the OopisOS environment.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { ErrorHandler, Config } = dependencies;
        setTimeout(() => {
            window.location.reload();
        }, 500);
        return ErrorHandler.createSuccess(
            "Rebooting OopisOS (reloading browser page)...",
            {
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            }
        );
    }
}

window.CommandRegistry.register(new RebootCommand());