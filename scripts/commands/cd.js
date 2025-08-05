/**
 * @file scripts/commands/cd.js
 * @description The 'cd' command, used to change the current working directory.
 * This file implements the logic for path resolution and updating the shell's state.
 */

/**
 * Represents the 'cd' (change directory) command.
 * @class CdCommand
 * @extends Command
 */
window.CdCommand = class CdCommand extends Command {
    /**
     * @constructor
     * @description Initializes the command's definition, including its validation rules
     * which ensure the target path is a directory and the user has execute permissions.
     */
    constructor() {
        super({
            commandName: "cd",
            description: "Changes the current working directory.",
            helpText: `Usage: cd <directory>
      Change the current working directory.
      DESCRIPTION
      The cd command changes the current working directory of the shell
      to the specified <directory>.
      The command recognizes special directory names:
      .      Refers to the current directory.
      ..     Refers to the parent directory of the current directory.
      Absolute paths (starting with /) and relative paths are supported.
      EXAMPLES
      cd /home/Guest
      Changes the current directory to /home/Guest.
      cd ../..
      Moves up two directory levels from the current location.
      PERMISSIONS
      To change into a directory, the user must have 'execute' (x)
      permissions on that directory.`,
            completionType: "paths",
            validations: {
                args: { exact: 1, error: "incorrect number of arguments" },
                paths: [
                    {
                        argIndex: 0,
                        options: { expectedType: 'directory', permissions: ['execute'] }
                    }
                ]
            },
        });
    }

    /**
     * Main logic for the 'cd' command.
     * It uses the pre-validated path from the command's execution context to update
     * the FileSystemManager's current path and then updates the terminal prompt.
     * @param {object} context - The command execution context.
     * @param {object} context.options - The options for command execution.
     * @param {Array<object>} context.validatedPaths - An array of path objects that have already been validated.
     * @param {object} context.dependencies - The system dependencies.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { options, validatedPaths, dependencies } = context;
        const { FileSystemManager, TerminalUI, ErrorHandler } = dependencies;
        const { resolvedPath } = validatedPaths[0];

        if (FileSystemManager.getCurrentPath() === resolvedPath) {
            return ErrorHandler.createSuccess("");
        }

        FileSystemManager.setCurrentPath(resolvedPath);

        if (options.isInteractive) {
            TerminalUI.updatePrompt();
        }

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new CdCommand());