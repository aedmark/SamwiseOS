/**
 * @file scripts/commands/clearfs.js
 * @description The 'clearfs' command, a utility for clearing all files and directories
 * from the current user's home directory after a confirmation prompt.
 */

/**
 * Represents the 'clearfs' command. It provides a way for a user to reset their
 * home directory to an empty state. For safety, it cannot be run by the root user.
 * @class ClearfsCommand
 * @extends Command
 */
window.ClearfsCommand = class ClearfsCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "clearfs",
            description: "Clears all files and directories from the current user's home directory.",
            helpText: `Usage: clearfs
      Clears the current user's home directory.
      DESCRIPTION
      The clearfs command removes all files and subdirectories within the
      current user's home directory, effectively resetting it to a clean slate.
      This command is useful for cleaning up test files or starting fresh without
      affecting other users on the system.
      WARNING
      This operation is irreversible and will permanently delete all data from
      your home directory. The command will prompt for confirmation.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Main logic for the 'clearfs' command.
     * It prompts the user for confirmation, then finds the user's home directory node
     * and resets its 'children' property to an empty object.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { currentUser, options, dependencies } = context;
        const { FileSystemManager, ModalManager, ErrorHandler, Config } = dependencies;

        if (currentUser === 'root') {
            return ErrorHandler.createError({
                message: "clearfs: cannot clear the root user's home directory for safety reasons."
            });
        }

        const confirmed = await new Promise((resolve) => {
            ModalManager.request({
                context: "terminal",
                messageLines: [
                    "WARNING: This will permanently delete all files and directories in your home folder.",
                    "This action cannot be undone. Are you sure?",
                ],
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                options,
            });
        });

        if (!confirmed) {
            return ErrorHandler.createSuccess("Operation cancelled.");
        }

        const homePath = `/home/${currentUser}`;
        const homeNode = FileSystemManager.getNodeByPath(homePath);

        if (homeNode && homeNode.children) {
            // Create a new empty children object to clear the directory
            homeNode.children = {};
            homeNode.mtime = new Date().toISOString();
            await FileSystemManager.save();
            return ErrorHandler.createSuccess("Home directory cleared.", { stateModified: true });
        }

        return ErrorHandler.createError({
            message: "clearfs: Could not find home directory to clear."
        });
    }
}

window.CommandRegistry.register(new ClearfsCommand());