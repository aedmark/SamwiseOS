// scripts/commands/log.js

/**
 * @fileoverview This file defines the 'log' command, which provides a personal,
 * timestamped journal application with both a quick-add command-line feature
 * and a full graphical interface.
 * @module commands/log
 */

/**
 * Represents the 'log' command, which can launch the log application or add a quick entry.
 * @class LogCommand
 * @extends Command
 */
window.LogCommand = class LogCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "log",
      dependencies: ["apps/log/log_ui.js", "apps/log/log_manager.js"],
      applicationModules: ["LogManager", "LogUI", "App"],
      description: "A personal, timestamped journal and log application.",
      helpText: `Usage: log ["entry text"]
      A personal journal for OopisOS.
      DESCRIPTION
      The 'log' command serves as your personal, timestamped journal.
      It has two modes of operation:
      1. Quick Add Mode:
      Running 'log' with a quoted string as an argument will instantly
      create a new, timestamped journal entry in /home/Guest/.journal/
      without opening the full application.
      2. Application Mode:
      Running 'log' with no arguments launches the full-screen graphical
      application, which allows you to view, search, edit, and manage
      all of your journal entries.
      EXAMPLES
      log "Finished the first draft of the proposal."
      Creates a new entry with the specified text.
      log
      Opens the main journal application.`,
      argValidation: {
        max: 1,
        error: 'Usage: log ["quick entry text"]',
      },
    });
  }

  /**
   * Executes the core logic of the 'log' command.
   * If an argument is provided, it creates a quick log entry.
   * Otherwise, it launches the full graphical log application.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {

    const { args, currentUser, options, dependencies } = context;
    const { ErrorHandler, LogManager, LogUI, App, AppLayerManager, Config } = dependencies;

    try {
      if (!options.isInteractive) {
        return ErrorHandler.createError({
          message: "log: Can only be run in interactive mode."
        });
      }

      if (
          typeof LogManager === "undefined" ||
          typeof LogUI === "undefined" ||
          typeof App === "undefined"
      ) {
        return ErrorHandler.createError({
          message: "log: The Log application module is not loaded."
        });
      }

      const logManager = new LogManager();
      logManager.dependencies = dependencies;

      if (args.length > 0) {
        const entryText = args.join(" ");
        const result = await logManager.quickAdd(entryText, currentUser);
        if (result.success) {
          return ErrorHandler.createSuccess(result.message, {
            messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            stateModified: true
          });
        } else {
          return ErrorHandler.createError({ message: result.error });
        }
      }

      AppLayerManager.show(logManager, { dependencies });

      return ErrorHandler.createSuccess("");
    } catch (e) {
      return ErrorHandler.createError({
        message: `log: An unexpected error occurred: ${e.message}`
      });
    }
  }
}

window.CommandRegistry.register(new LogCommand());