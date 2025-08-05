// scripts/commands/groupadd.js

/**
 * @fileoverview This file defines the 'groupadd' command, a utility restricted
 * to the root user for creating new user groups within the OopisOS system.
 * @module commands/groupadd
 */

/**
 * Represents the 'groupadd' command for creating new user groups.
 * @class GroupaddCommand
 * @extends Command
 */
window.GroupaddCommand = class GroupaddCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "groupadd",
            description: "Creates a new user group.",
            helpText: `Usage: groupadd <groupname>
      Create a new user group.
      DESCRIPTION
      The groupadd command creates a new group with the specified
      <groupname>. Once a group is created, users can be added to it
      with the 'usermod' command, and file group ownership can be
      changed with the 'chgrp' command to manage permissions for
      shared resources.
      Group names cannot contain spaces.
      EXAMPLES
      groupadd developers
      Creates a new group named 'developers'.
      PERMISSIONS
      Only the superuser (root) can create new groups.`,
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: groupadd <groupname>"
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'groupadd' command.
     * It ensures the current user is root, checks if the group already exists,
     * and then creates the new group.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { GroupManager, ErrorHandler } = dependencies;
        const groupName = args[0];

        if (currentUser !== "root") {
            return ErrorHandler.createError({
                message: "groupadd: only root can add groups."
            });
        }

        if (GroupManager.groupExists(groupName)) {
            return ErrorHandler.createError({
                message: `groupadd: group '${groupName}' already exists.`
            });
        }

        GroupManager.createGroup(groupName);

        return ErrorHandler.createSuccess(`Group '${groupName}' created.`);
    }
}

window.CommandRegistry.register(new GroupaddCommand());