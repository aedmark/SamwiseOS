// scripts/commands/pwd.js

/**
 * @fileoverview This file defines the 'pwd' command, a utility for printing
 * the full, absolute path of the current working directory.
 * @module commands/pwd
 */

/**
 * Represents the 'pwd' (print working directory) command.
 * @class PwdCommand
 * @extends Command
 */
window.PwdCommand = class PwdCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "pwd",
      description: "Prints the current working directory.",
      helpText: `Usage: pwd
      Print the full path of the current working directory.
      DESCRIPTION
      The pwd (print working directory) command writes the full, absolute
      pathname of the current working directory to the standard output.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'pwd' command.
   * It simply retrieves the current path from the FileSystemManager
   * and returns it as a success result.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { dependencies } = context;
    const { ErrorHandler, FileSystemManager } = dependencies;
    return ErrorHandler.createSuccess(FileSystemManager.getCurrentPath());
  }
}

window.CommandRegistry.register(new PwdCommand());