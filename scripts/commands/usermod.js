/**
 * @fileoverview This file defines the 'usermod' command, a utility for modifying
 * a user account, primarily to add them to supplementary groups.
 * @module commands/usermod
 */

/**
 * Represents the 'usermod' (user modify) command.
 * @class UsermodCommand
 * @extends Command
 */
window.UsermodCommand = class UsermodCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "usermod",
            description: "Modifies a user account, primarily for group membership.",
            helpText: `Usage: usermod -aG <groupname> <username>
      Modify a user account.
      DESCRIPTION
      The usermod command modifies the user account specified by
      <username>. Its primary function in OopisOS is to add a user to a
      supplementary group.
      OPTIONS
      -aG <groupname>
      Add the user to the supplementary <groupname>. The -a flag
      (append) is important to ensure the user is not removed
      from other groups. The -G flag specifies that we are
      modifying a group membership. In OopisOS, these flags
      must be used together.
      PERMISSIONS
      Only the superuser (root) can modify user accounts.
      EXAMPLES
      usermod -aG developers newdev
      Adds the user 'newdev' to the 'developers' group.`,
            completionType: "users",
            argValidation: {
                exact: 3,
                error: "Usage: usermod -aG <groupname> <username>",
            },
        });
    }

    /**
     * Executes the core logic of the 'usermod' command. It performs checks to
     * ensure the current user is root and that the target user and group exist.
     * If all checks pass, it adds the user to the specified group.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { ErrorHandler, GroupManager, UserManager, Config } = dependencies;

        const flag = args[0];
        const groupName = args[1];
        const username = args[2];

        if (currentUser !== "root") {
            return ErrorHandler.createError({
                message: "only root can modify user groups.",
                suggestion: "Try running this command with 'sudo'.",
            });
        }

        if (flag !== "-aG") {
            return ErrorHandler.createError({
                message: `invalid flag: ${flag}`,
                suggestion: "The only supported flag combination is '-aG'. See 'man usermod'.",
            });
        }

        if (!GroupManager.groupExists(groupName)) {
            return ErrorHandler.createError({
                message: `group '${groupName}' does not exist.`,
                suggestion: "Use 'groupadd' to create the group first.",
            });
        }

        if (
            !(await UserManager.userExists(username)) &&
            username !== Config.USER.DEFAULT_NAME
        ) {
            return ErrorHandler.createError({
                message: `user '${username}' does not exist.`,
                suggestion: "Use 'listusers' to see all available users.",
            });
        }

        const userAdded = GroupManager.addUserToGroup(username, groupName);

        if (userAdded) {
            return ErrorHandler.createSuccess(
                `Added user '${username}' to group '${groupName}'.`,
                { stateModified: true }
            );
        } else {
            return ErrorHandler.createSuccess(
                `User '${username}' is already in group '${groupName}'.`
            );
        }
    }
}

window.CommandRegistry.register(new UsermodCommand());