// scripts/commands/listusers.js

/**
 * @fileoverview This file defines the 'listusers' command, a utility for displaying
 * all registered user accounts on the OopisOS system.
 * @module commands/listusers
 */

/**
 * Represents the 'listusers' command.
 * @class ListusersCommand
 * @extends Command
 */
window.ListusersCommand = class ListusersCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "listusers",
            description: "Lists all registered users on the system.",
            helpText: `Usage: listusers
      List all registered users.
      DESCRIPTION
      The listusers command displays a list of all user accounts that
      currently exist on the system.
      EXAMPLES
      listusers
      Registered users:
      Guest
      root
      userDiag`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'listusers' command.
     * It retrieves the list of all registered users from storage, ensures the default
     * guest user is included, sorts the list, and formats it for display.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { StorageManager, Config, ErrorHandler } = dependencies;
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        let userNames = Object.keys(users);

        if (!userNames.includes(Config.USER.DEFAULT_NAME)) {
            userNames.push(Config.USER.DEFAULT_NAME);
        }

        userNames.sort();

        if (userNames.length === 0)
            return ErrorHandler.createSuccess("No users registered.");

        const output =
            "Registered users:\n" + userNames.map((u) => `  ${u}`).join("\n");
        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new ListusersCommand());