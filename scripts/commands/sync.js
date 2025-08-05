/**
 * @fileoverview This file defines the 'sync' command, a utility for manually
 * forcing the in-memory file system to be saved to persistent storage.
 * @module commands/sync
 */

/**
 * Represents the 'sync' command.
 * @class SyncCommand
 * @extends Command
 */
window.SyncCommand = class SyncCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "sync",
      description: "Manually saves the current file system to the database.",
      helpText: `Usage: sync
      Synchronize cached file data with persistent storage.
      DESCRIPTION
      The sync command writes any buffered file system modifications to
      the underlying persistent storage (IndexedDB).
      In OopisOS, this happens automatically on events like logout, but
      'sync' provides a way to force a save manually, ensuring data

      persistence without ending the session.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'sync' command. It calls the
   * FileSystemManager's save method to write the current state of the
   * virtual filesystem to persistent storage.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { dependencies, currentUser } = context;
    const { FileSystemManager, ErrorHandler } = dependencies;

    try {
      await FileSystemManager.save(currentUser);
      return ErrorHandler.createSuccess(
          "File system cache synchronized with persistent storage."
      );
    } catch (e) {
      return ErrorHandler.createError({ message: `sync: An error occurred during synchronization: ${e.message}` });
    }
  }
}

window.CommandRegistry.register(new SyncCommand());