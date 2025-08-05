/**
 * @fileoverview This file defines the 'unzip' command, a utility for extracting
 * the contents of a JSON-based .zip archive created by the 'zip' command.
 * @module commands/unzip
 */

/**
 * Recursively restores a file or directory structure from an archive object.
 * @param {string} name - The name of the current node to restore.
 * @param {object} nodeData - The object representing the file or directory from the archive.
 * @param {string} parentPath - The absolute path of the parent directory to restore into.
 * @param {object} dependencies - The dependency injection container.
 * @param {string} currentUser - The name of the user executing the command.
 * @returns {Promise<void>}
 * @private
 * @throws {Error} If file or directory creation fails.
 */
async function _restoreNode(name, nodeData, parentPath, dependencies, currentUser) {
    const { FileSystemManager, UserManager } = dependencies;
    const fullPath = FileSystemManager.getAbsolutePath(name, parentPath);

    if (nodeData.type === 'file') {
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const result = await FileSystemManager.createOrUpdateFile(
            fullPath,
            nodeData.content || '',
            { currentUser, primaryGroup }
        );
        if (!result.success) {
            throw new Error(`Failed to create file ${fullPath}: ${result.error}`);
        }
    } else if (nodeData.type === 'directory') {
        const mkdirResult = await FileSystemManager.createOrUpdateFile(
            fullPath,
            null,
            {
                isDirectory: true,
                currentUser: currentUser,
                primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
            }
        );

        if (!mkdirResult.success) {
            throw new Error(`Failed to create directory ${fullPath}: ${mkdirResult.error}`);
        }

        if (nodeData.children) {
            for (const childName in nodeData.children) {
                await _restoreNode(childName, nodeData.children[childName], fullPath, dependencies, currentUser);
            }
        }
    }
}

/**
 * Represents the 'unzip' command for extracting .zip archives.
 * @class UnzipCommand
 * @extends Command
 */
window.UnzipCommand = class UnzipCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "unzip",
            description: "Extracts files from a .zip archive.",
            helpText: `Usage: unzip <archive.zip>
      Extract files from a OopisOS zip archive.
      DESCRIPTION
      The unzip command extracts the contents of a .zip file created with
      the 'zip' command. It recreates the archived directory structure
      in the current working directory.
      If files or directories from the archive already exist in the
      current location, they will be overwritten.
      EXAMPLES
      unzip my_project.zip
      Extracts the contents of 'my_project.zip' into the current
      directory.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: unzip <archive.zip>"
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    /**
     * Executes the core logic of the 'unzip' command. It reads the specified
     * .zip file, parses its JSON content, and then recursively recreates the
     * archived file and directory structure in the current working directory.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { currentUser, validatedPaths, dependencies } = context;
        const { ErrorHandler, FileSystemManager } = dependencies;

        if (!validatedPaths || validatedPaths.length === 0) {
            return ErrorHandler.createError({ message: "unzip: missing file operand" });
        }

        const { node: archiveNode, arg: archivePath } = validatedPaths[0];

        if (!archiveNode || !archivePath.endsWith(".zip")) {
            return ErrorHandler.createError({ message: "unzip: provided file is not a .zip archive." });
        }

        let archiveData;
        try {
            archiveData = JSON.parse(archiveNode.content || "{}");
        } catch (e) {
            return ErrorHandler.createError({ message: `unzip: cannot process archive, invalid JSON format. ${e.message}` });
        }

        const currentDirectory = FileSystemManager.getCurrentPath();

        try {
            for (const name in archiveData) {
                await _restoreNode(
                    name,
                    archiveData[name],
                    currentDirectory,
                    dependencies,
                    currentUser
                );
            }
            await FileSystemManager.save();
            return ErrorHandler.createSuccess(
                `Archive '${archivePath}' successfully unzipped.`
            );
        } catch (e) {
            return ErrorHandler.createError({ message: `unzip: an error occurred during extraction: ${e.message}` });
        }
    }
}

window.CommandRegistry.register(new UnzipCommand());