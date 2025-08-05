/**
 * @fileoverview This file defines the 'whoami' command, a simple utility for
 * displaying the username of the currently active user.
 * @module commands/whoami
 */

/**
 * Represents the 'whoami' command.
 * @class WhoamiCommand
 * @extends Command
 */
window.WhoamiCommand = class WhoamiCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "whoami",
      description: "Prints the current effective user name.",
      helpText: `Usage: whoami
      Print the current user name.
      DESCRIPTION
      The whoami command prints the user name associated with the
      current effective user ID.`,
      argValidation: {
        exact: 0,
      },
    });
  }

  /**
   * Executes the core logic of the 'whoami' command. It retrieves the
   * current user's name from the UserManager and returns it as a success result.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { dependencies } = context;
    const { ErrorHandler, UserManager } = dependencies;
    return ErrorHandler.createSuccess(UserManager.getCurrentUser().name);
  }
}

window.CommandRegistry.register(new WhoamiCommand());