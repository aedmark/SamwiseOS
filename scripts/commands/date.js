// scripts/commands/date.js

/**
 * @fileoverview This file defines the 'date' command, a simple utility for displaying
 * the current system date and time.
 * @module commands/date
 */

/**
 * Represents the 'date' command.
 * @class DateCommand
 * @extends Command
 */
window.DateCommand = class DateCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "date",
      description: "Display the current system date and time.",
      helpText: `Usage: date
      Display the current system date and time.
      DESCRIPTION
      The date command prints the current date and time as determined
      by the user's browser, including timezone information.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'date' command.
   * It retrieves the current date and time and returns it as a string.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success object containing the current date string.
   */
  async coreLogic(context) {
    const { ErrorHandler } = context.dependencies;
    return ErrorHandler.createSuccess(new Date().toString());
  }
}

window.CommandRegistry.register(new DateCommand());