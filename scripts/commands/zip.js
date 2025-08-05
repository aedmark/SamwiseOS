/**
 * @fileoverview This file defines the 'zip' command, a utility for creating a
 * JSON-based archive of a file or directory structure.
 * @module commands/zip
 */

/**
 * Recursively creates an object representation of a filesystem node for archiving.
 * @param {object} node - The filesystem node to archive.
 * @param {object} dependencies - The dependency injection container.
 * @returns {Promise<object|null>} A promise that resolves to an archive-ready object, or null.
 * @private
 */
async function _archiveNode(node, dependencies) {
    const { Config } = dependencies;
    if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
        return {
            type: "file",
            content: node.content,
        };
    }

    if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
        const children = {};
        const childNames = Object.keys(node.children).sort();
        for (const childName of childNames) {
            const childNode = node.children[childName];
            children[childName] = await _archiveNode(childNode, dependencies);
        }
        return {
            type: "directory",
            children: children,
        };
    }
    return null;
}

/**
 * Represents the 'zip' command for creating file and directory archives.
 * @class ZipCommand
 * @extends Command
 */
window.ZipCommand = class ZipCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "zip",
            description: "Creates a compressed .zip archive of a file or directory.",
            helpText: `Usage: zip <archive.zip> <path>
      Creates a simulated compressed archive of a file or directory.
      DESCRIPTION
      The zip command recursively archives the contents of the specified
      <path> into a single file named <archive.zip>. The resulting
      .zip file is a JSON representation of the file structure, not
      a standard binary zip file. It can be unzipped using the 'unzip'
      command.
      EXAMPLES
      zip my_project.zip /home/Guest/project
      Creates 'my_project.zip' containing the 'project' directory.`,
            completionType: "paths",
            argValidation: {
                exact: 2,
                error: "Usage: zip <archive.zip> <path_to_zip>",
            },
        });
    }

    /**
     * Executes the core logic of the 'zip' command. It validates the source
     * and destination paths, recursively builds a JSON representation of the
     * source file or directory, and saves it to the destination archive file.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { ErrorHandler, FileSystemManager, OutputManager, UserManager } = dependencies;
        let archivePath = args[0];
        const sourcePath = args[1];

        if (!archivePath.endsWith(".zip")) {
            archivePath += ".zip";
        }

        const sourceValidationResult = FileSystemManager.validatePath(
            sourcePath,
            {
                permissions: ["read"],
            }
        );
        if (!sourceValidationResult.success) {
            return ErrorHandler.createError({ message: `zip: ${sourceValidationResult.error}` });
        }
        const sourceValidation = sourceValidationResult.data;

        const archiveValidationResult = FileSystemManager.validatePath(
            archivePath,
            {
                allowMissing: true,
                expectedType: "file",
            }
        );
        if (
            !archiveValidationResult.success &&
            archiveValidationResult.data?.node
        ) {
            return ErrorHandler.createError({ message: `zip: ${archiveValidationResult.error}` });
        }
        const archiveValidation = archiveValidationResult.data;
        if (
            archiveValidation.node &&
            archiveValidation.node.type === "directory"
        ) {
            return ErrorHandler.createError({ message: `zip: cannot overwrite directory '${archivePath}' with a file` });
        }

        await OutputManager.appendToOutput(`Zipping '${sourcePath}'...`);

        const sourceName =
            sourceValidation.resolvedPath.split("/").pop() ||
            sourceValidation.resolvedPath;
        const archiveObject = {
            [sourceName]: await _archiveNode(sourceValidation.node, dependencies),
        };
        const archiveContent = JSON.stringify(archiveObject, null, 2);

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            archiveValidation.resolvedPath,
            archiveContent,
            { currentUser, primaryGroup }
        );

        if (!saveResult.success) {
            return ErrorHandler.createError({ message: `zip: ${saveResult.error}` });
        }

        return ErrorHandler.createSuccess(
            `Successfully zipped '${sourcePath}' to '${archivePath}'.`,
            { stateModified: true }
        );
    }
}

window.CommandRegistry.register(new ZipCommand());