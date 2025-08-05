// scripts/commands/rename.js

/**
 * @fileoverview This file defines the 'rename' command, a utility for renaming
 * a single file or directory within its current location.
 * @module commands/rename
 */

/**
 * Represents the 'rename' command.
 * @class RenameCommand
 * @extends Command
 */
window.RenameCommand = class RenameCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "rename",
            description: "Renames a file or directory.",
            helpText: `Usage: rename <old_name> <new_name>
      Rename a file or directory in the current location.
      DESCRIPTION
      The rename command changes the name of a single file or directory
      from <old_name> to <new_name>. It is a safer, more explicit
      alternative to 'mv' for renaming operations, as it will not
      move the file to a different directory.
      Both <old_name> and <new_name> must be in the same directory.
      EXAMPLES
      rename report-draft.txt report-final.txt
      Renames the draft report to its final name.
      rename ./images ./pictures
      Renames the 'images' directory to 'pictures'.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 2,
                    error: "Usage: rename <old_name> <new_name>"
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        allowMissing: false
                    }
                }]
            },
        });
    }

    /**
     * Executes the core logic of the 'rename' command.
     * It validates that the new name is not a path and does not already exist,
     * then uses the 'mv' command internally to perform the rename operation.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, validatedPaths, dependencies } = context;
        const { FileSystemManager, ErrorHandler } = dependencies;

        const oldName = args[0];
        const newName = args[1];
        const { node: sourceNode, resolvedPath: sourcePath } = validatedPaths[0];

        if (newName.includes(FileSystemManager.config.FILESYSTEM.PATH_SEPARATOR)) {
            return ErrorHandler.createError({
                message: "Invalid new name. Cannot contain path separators.",
                suggestion: "Use the 'mv' command to move files to a different directory.",
            });
        }

        const parentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
        const newPath = FileSystemManager.getAbsolutePath(newName, parentPath);

        if (FileSystemManager.getNodeByPath(newPath)) {
            return ErrorHandler.createError({
                message: `cannot rename '${oldName}' to '${newName}': File exists`,
                suggestion: "Choose a different name or use 'ls' to check the directory's contents.",
            });
        }

        const mvResult = await dependencies.CommandExecutor.processSingleCommand(
            `mv "${sourcePath}" "${newPath}"`, { isInteractive: false }
        );

        if (mvResult.success) {
            return ErrorHandler.createSuccess("", { stateModified: true });
        } else {
            return ErrorHandler.createError({ message: `rename: ${mvResult.error.message || mvResult.error}` });
        }
    }
}

window.CommandRegistry.register(new RenameCommand());