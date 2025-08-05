/**
 * @fileoverview This file defines the 'rmdir' command, a utility for removing
 * empty directories from the filesystem.
 * @module commands/rmdir
 */

/**
 * Represents the 'rmdir' (remove directory) command.
 * @class RmdirCommand
 * @extends Command
 */
window.RmdirCommand = class RmdirCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "rmdir",
      description: "Removes empty directories.",
      helpText: `Usage: rmdir <directory>...
      Remove empty directories.
      DESCRIPTION
      The rmdir command removes one or more empty directories.
      If a specified directory is not empty, the command will fail
      for that operand.
      To remove non-empty directories and their contents, use the
      'rm -r' command instead.
      EXAMPLES
      rmdir old_project
      Removes the 'old_project' directory, but only if it is empty.`,
      completionType: "paths",
      validations: {
        args: {
          min: 1,
          error: "missing operand"
        },
        paths: [{
          argIndex: 'all',
          options: {
            expectedType: 'directory',
            ownershipRequired: true
          },
        }, ],
      },
    });
  }

  /**
   * Executes the core logic of the 'rmdir' command. It iterates through
   * the provided directory paths, verifies that each is empty, and then
   * removes it from its parent directory in the filesystem.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { validatedPaths, dependencies } = context;
    const { FileSystemManager, ErrorHandler } = dependencies;
    let allSuccess = true;
    let anyChangeMade = false;
    const errorMessages = [];

    for (const pathData of validatedPaths) {
      const { node, resolvedPath } = pathData;

      if (Object.keys(node.children).length > 0) {
        return ErrorHandler.createError({
          message: `failed to remove '${pathData.arg}': Directory not empty`,
          suggestion: "Use 'rm -r' to remove directories and their contents.",
        });
      }

      const parentPath = resolvedPath.substring(
          0,
          resolvedPath.lastIndexOf("/")
      );
      const dirName = resolvedPath.substring(
          resolvedPath.lastIndexOf("/") + 1
      );
      const parentNode = FileSystemManager.getNodeByPath(parentPath);

      if (parentNode && parentNode.children[dirName]) {
        delete parentNode.children[dirName];
        parentNode.mtime = new Date().toISOString();
        anyChangeMade = true;
      } else {
        errorMessages.push(
            `rmdir: failed to remove '${pathData.arg}': Directory not found in parent`
        );
        allSuccess = false;
      }
    }

    if (!allSuccess) {
      return ErrorHandler.createError({ message: errorMessages.join("\n") });
    }
    return ErrorHandler.createSuccess("", { stateModified: anyChangeMade });
  }
}

window.CommandRegistry.register(new RmdirCommand());