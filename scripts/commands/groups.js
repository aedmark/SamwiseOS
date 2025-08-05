// scripts/commands/groups.js

/**
 * @fileoverview This file defines the 'groups' command, a utility for displaying
 * the group memberships of a specified user or the current user.
 * @module commands/groups
 */

/**
 * Represents the 'groups' command.
 * @class GroupsCommand
 * @extends Command
 */
window.GroupsCommand = class GroupsCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "groups",
            description: "Prints the groups a user is in.",
            helpText: `Usage: groups [username]
      Print group memberships for a user.
      DESCRIPTION
      The groups command prints the names of the primary and supplementary
      groups for each given username, or the current process if none are
      given.
      EXAMPLES
      groups
      Displays the groups for the current user.
      groups root
      Displays the groups for the 'root' user.`,
            completionType: "users",
            argValidation: {
                max: 1,
            },
        });
    }

    /**
     * Executes the core logic of the 'groups' command.
     * It identifies the target user, validates their existence, and then
     * retrieves and displays a space-separated list of their group memberships.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { UserManager, GroupManager, ErrorHandler } = dependencies;
        const targetUser = args.length > 0 ? args[0] : currentUser;

        if (!(await UserManager.userExists(targetUser))) {
            return ErrorHandler.createError({
                message: `groups: user '${targetUser}' does not exist`
            });
        }

        const userGroups = GroupManager.getGroupsForUser(targetUser);

        if (userGroups.length === 0) {
            return ErrorHandler.createSuccess(
                `groups: user '${targetUser}' is not a member of any group`
            );
        }

        return ErrorHandler.createSuccess(userGroups.join(" "));
    }
}

window.CommandRegistry.register(new GroupsCommand());