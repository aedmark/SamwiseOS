/**
 * @fileoverview This file defines the 'su' command, a utility for switching
 * to another user account and stacking the new session on top of the current one.
 * @module commands/su
 */

/**
 * Represents the 'su' (substitute user) command.
 * @class SuCommand
 * @extends Command
 */
window.SuCommand = class SuCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "su",
            description: "Switches to another user, stacking the session.",
            helpText: `Usage: su [username] [password]
      Change the current user ID to another user.
      DESCRIPTION
      The su (substitute user) command allows you to run a new shell
      session as another user. If no <username> is provided, it defaults
      to 'root'.
      If the target account has a password, you will be prompted to
      enter it.
      This command "stacks" the new session on top of the old one.
      To return to your original user session, use the 'logout' command.
      This is different from 'login', which replaces the current
      session entirely.
      EXAMPLES
      su
      Switches to the 'root' user (will prompt for password).
      su Guest
      Switches to the 'Guest' user.`,
            completionType: "users",
            validations: {
                args: {
                    max: 2,
                },
            },
        });
    }

    /**
     * Executes the core logic of the 'su' command. It determines the target
     * user and passes the credentials to the UserManager to handle the session
     * switch. It then formats a welcome message for the new user session.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, options, dependencies } = context;
        const { UserManager, ErrorHandler, Config } = dependencies;
        const targetUser = args.length > 0 ? args[0] : "root";
        const providedPassword = args.length > 1 ? args[1] : null;

        const result = await UserManager.su(
            targetUser,
            providedPassword,
            options
        );
        if (result.success) {
            const resultData = result.data || {};
            if (!resultData.noAction) {
                return ErrorHandler.createSuccess(
                    `${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`,
                    { effect: "clear_screen" }
                );
            }
            return ErrorHandler.createSuccess(resultData.message);
        } else {
            return result;
        }
    }
}

window.CommandRegistry.register(new SuCommand());