// scripts/commands/login.js

/**
 * @fileoverview This file defines the 'login' command, which handles user
 * authentication and initiates a new, clean session for the specified user.
 * @module commands/login
 */

/**
 * Represents the 'login' command.
 * @class LoginCommand
 * @extends Command
 */
window.LoginCommand = class LoginCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "login",
            description: "Logs in as a user, starting a new session.",
            helpText: `Usage: login <username> [password]
      Log in as a user and start a new session.
      DESCRIPTION
      The login command starts a new session for the specified <username>.
      If the user account has a password, and one is not provided in the
      command, the system will prompt for it.
      Unlike the 'su' command which stacks user sessions, 'login'
      clears any existing session stack and starts a fresh one. This
      means any active 'su' sessions will be terminated.
      EXAMPLES
      login root
      Prompts for the root user's password and logs in.
      login Guest
      Logs in as the Guest user (no password required).`,
            completionType: "users",
            validations: {
                args: {
                    min: 1,
                    max: 2,
                    error: "Usage: login <username> [password]"
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'login' command.
     * It passes the provided username and optional password to the UserManager to handle
     * the authentication and session switching, then formats the output for the user.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, options, dependencies } = context;
        const { UserManager, ErrorHandler, Config } = dependencies;
        const username = args[0];
        const providedPassword = args.length === 2 ? args[1] : null;

        const result = await UserManager.login(
            username,
            providedPassword,
            options
        );

        if (result.success) {
            const resultData = result.data || {};
            if (resultData.isLogin) {
                return ErrorHandler.createSuccess(
                    `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`,
                    { effect: "clear_screen" }
                );
            }
            if (resultData.noAction) {
                return ErrorHandler.createSuccess(resultData.message);
            }
            return ErrorHandler.createSuccess(null);
        } else {
            return result;
        }
    }
}

window.CommandRegistry.register(new LoginCommand());