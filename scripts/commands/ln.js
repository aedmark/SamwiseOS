// scripts/commands/ln.js

/**
 * @fileoverview This file defines the 'ln' command, a utility for creating
 * symbolic links between files in the OopisOS virtual file system.
 * @module commands/ln
 */

/**
 * Represents the 'ln' (link) command.
 * @class LnCommand
 * @extends Command
 */
window.LnCommand = class LnCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "ln",
            description: "Create links between files.",
            helpText: `Usage: ln -s <target> <link_name>
      Create a symbolic link.
      DESCRIPTION
      The ln command creates a symbolic link at <link_name> that points to <target>.
      Currently, only symbolic links created with the -s flag are supported.
      EXAMPLES
      ln -s /home/Guest/documents/report.txt /home/Guest/recent_report.txt
      Creates a symbolic link named 'recent_report.txt' that points to the original report.`,
            flagDefinitions: [{ name: "symbolic", short: "-s" }],
            validations: {
                args: { exact: 2, error: "Usage: ln -s <target> <link_name>" }
            },
        });
    }

    /**
     * Executes the core logic of the 'ln' command.
     * It validates that a symbolic link is being created, checks for path validity
     * and permissions, and then creates the new symbolic link node in the file system.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;

        if (!flags.symbolic) {
            return ErrorHandler.createError({ message: "ln: only symbolic links (-s) are supported." });
        }

        const target = args[0];
        const linkName = args[1];

        const linkPath = FileSystemManager.getAbsolutePath(linkName);
        const parentDir = linkPath.substring(0, linkPath.lastIndexOf('/')) || '/';

        if (FileSystemManager.getNodeByPath(linkPath)) {
            return ErrorHandler.createError({ message: `ln: failed to create symbolic link '${linkName}': File exists` });
        }

        const parentNode = FileSystemManager.getNodeByPath(parentDir);
        if (!parentNode || parentNode.type !== 'directory') {
            return ErrorHandler.createError({ message: `ln: cannot create symbolic link in '${parentDir}': No such file or directory` });
        }

        if (!FileSystemManager.hasPermission(parentNode, currentUser, 'write')) {
            return ErrorHandler.createError({ message: `ln: cannot create symbolic link in '${parentDir}': Permission denied` });
        }

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const symlinkNode = FileSystemManager._createNewSymlinkNode(target, currentUser, primaryGroup);

        const finalLinkName = linkPath.substring(linkPath.lastIndexOf('/') + 1);
        parentNode.children[finalLinkName] = symlinkNode;

        return ErrorHandler.createSuccess("", { stateModified: true });
    }
}

window.CommandRegistry.register(new LnCommand());