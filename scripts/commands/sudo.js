/**
 * @fileoverview This file defines the 'sudo' command, a critical utility for
 * executing commands with superuser (root) privileges, handling password
 * authentication and sudoers policy checks.
 * @module commands/sudo
 */

/**
 * Represents the 'sudo' (superuser do) command.
 * @class SudoCommand
 * @extends Command
 */
window.SudoCommand = class SudoCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "sudo",
      description: "Executes a command as the superuser (root).",
      helpText: `Usage: sudo <command> [arguments]
      Execute a command with superuser privileges.
      DESCRIPTION
      sudo allows a permitted user to execute a command as the superuser or another
      user, as specified by the security policy in the /etc/sudoers file.
      If the user has a valid timestamp (i.e., they have successfully authenticated
      recently), the command is executed without a password prompt. Otherwise, sudo
      requires the user to authenticate with their own password.
      To edit the sudoers file, use the 'visudo' command.`,
      completionType: "commands",
      argValidation: {
        min: 1,
        error: "usage: sudo <command> [args ...]",
      },
    });
  }

  /**
   * Executes the core logic of the 'sudo' command. It checks if the user is
   * permitted to run the specified command as root based on the sudoers file.
   * If a password is required, it prompts for it interactively. On successful
   * authentication, it executes the command with root privileges.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { args, currentUser, options, dependencies } = context;
    const { ErrorHandler, CommandExecutor, SudoManager, UserManager, ModalManager } = dependencies;

    const commandToRun = args[0];
    const fullCommandStr = args.join(" ");

    if (currentUser === "root") {
      const result = await CommandExecutor.processSingleCommand(
          fullCommandStr,
          { isInteractive: options.isInteractive }
      );
      if (result.success) {
        return ErrorHandler.createSuccess(result.output);
      }
      return ErrorHandler.createError(result.error);
    }

    if (
        !SudoManager.canUserRunCommand(currentUser, commandToRun) &&
        !SudoManager.canUserRunCommand(currentUser, "ALL")
    ) {
      return ErrorHandler.createError(
          `sudo: Sorry, user ${currentUser} is not allowed to execute '${commandToRun}' as root on OopisOs.`
      );
    }

    if (SudoManager.isUserTimestampValid(currentUser)) {
      const { AuditManager } = dependencies;
      AuditManager.log(currentUser, 'sudo_exec', `COMMAND: ${fullCommandStr}`);
      const result = await UserManager.sudoExecute(fullCommandStr, options);
      if (result.success) {
        return ErrorHandler.createSuccess(result.output);
      }
      return ErrorHandler.createError(result.error);
    }

    return new Promise((resolve) => {
      ModalManager.request({
        context: "terminal",
        type: "input",
        messageLines: [`[sudo] password for ${currentUser}:`],
        obscured: true,
        onConfirm: async (password) => {
          const authResult = await UserManager.verifyPassword(
              currentUser,
              password
          );

          if (authResult.success) {
            SudoManager.updateUserTimestamp(currentUser);
            const execResult = await UserManager.sudoExecute(
                fullCommandStr,
                options
            );
            if (execResult.success) {
              resolve(ErrorHandler.createSuccess(execResult.output));
            } else {
              resolve(ErrorHandler.createError(execResult.error));
            }
          } else {
            resolve(ErrorHandler.createError("sudo: Sorry, try again."));
          }
        },
        onCancel: () => resolve(ErrorHandler.createSuccess("")),
        options,
      });
    });
  }
}

window.CommandRegistry.register(new SudoCommand());