// scripts/commands/groupdel.js

/**
 * @fileoverview This file defines the 'groupdel' command, a utility restricted
 * to the root user for creating new user groups within the OopisOS system.
 * @module commands/groupdel
 */

/**
 * Represents the 'groupdel' command for creating new user groups.
 * @class GroupdelCommand
 * @extends Command
 */
window.GroupdelCommand = class GroupdelCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "groupdel",
            description: "Deletes an existing user group.",
            helpText: `Usage: groupdel <groupname>
      Delete an existing user group.
      DESCRIPTION
      The groupdel command deletes the group specified by <groupname>.
      You cannot remove the primary group of an existing user. You must
      either delete the user first ('removeuser') or change their
      primary group before deleting the group.
      EXAMPLES
      groupdel developers
      Deletes the group named 'developers'.
      PERMISSIONS
      Only the superuser (root) can delete groups.`,
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: groupdel <groupname>"
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'groupdel' command.
     * It ensures the current user is root, checks if the group already exists,
     * and then creates the new group.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { GroupManager, ErrorHandler, StorageManager } = dependencies;
        const groupName = args[0];

        if (currentUser !== "root") {
            return ErrorHandler.createError(
                "groupdel: only root can delete groups."
            );
        }

        const users = StorageManager.loadItem(dependencies.Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const primaryUser = Object.keys(users).find(user => users[user].primaryGroup === groupName);

        if (primaryUser) {
            return ErrorHandler.createError({
                message: `cannot remove group '${groupName}': it is the primary group of user '${primaryUser}'`,
                suggestion: `Delete the user '${primaryUser}' first, or change their primary group.`,
            });
        }

        const result = GroupManager.deleteGroup(groupName);

        if (!result.success) {
            return ErrorHandler.createError(`groupdel: ${result.error}`);
        }

        return ErrorHandler.createSuccess(`Group '${groupName}' deleted.`);
    }
}

window.CommandRegistry.register(new GroupdelCommand());