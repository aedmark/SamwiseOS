// gem/scripts/user_manager.js

/**
 * @class UserManager
 * @classdesc An API client for the OopisOS Python User Manager kernel.
 */

class UserManager {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.config = dependencies.Config;
        this.fsManager = dependencies.FileSystemManager;
        this.groupManager = dependencies.GroupManager;
        this.storageManager = dependencies.StorageManager;
        this.sessionManager = null;
        this.sudoManager = null;
        this.commandExecutor = null;
        this.modalManager = null;
    }

    setDependencies(sessionManager, sudoManager, commandExecutor, modalManager) {
        this.sessionManager = sessionManager;
        this.sudoManager = sudoManager;
        this.commandExecutor = commandExecutor;
        this.modalManager = modalManager;
    }

    _saveUsers() {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "get_all_users"));
        const allUsers = result.success ? result.data : {};
        this.storageManager.saveItem(this.config.STORAGE_KEYS.USER_CREDENTIALS, allUsers, "User list");
    }

    syncAndSave(usersData) {
        const { StorageManager, Config } = this.dependencies;
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, usersData, "User list");
        OopisOS_Kernel.syscall("users", "load_users", [usersData]);
    }

    getCurrentUser() {
        // NEW: Always get the current user from the session manager, which asks Python.
        return { name: this.sessionManager.getCurrentUserFromStack() };
    }

    getPrimaryGroupForUser(username) {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "get_user", [username]));
        return (result.success && result.data) ? result.data.primaryGroup : null;
    }

    async userExists(username) {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "user_exists", [username]));
        return result.success && result.data;
    }

    async hasPassword(username) {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "has_password", [username]));
        return result.success && result.data;
    }

    async register(username, password) {
        const { Utils, ErrorHandler } = this.dependencies;
        const formatValidation = Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid) return ErrorHandler.createError(formatValidation.error);
        if (await this.userExists(username)) return ErrorHandler.createError(`User '${username}' already exists.`);

        this.groupManager.createGroup(username);
        this.groupManager.addUserToGroup(username, username);

        // The Python 'useradd' command now handles home directory creation.
        // We just need to call it non-interactively with the password.
        const result = await this.commandExecutor.processSingleCommand(`useradd ${username}`, {
            isInteractive: false,
            suppressOutput: true,
            stdinContent: `${password}\n${password}`
        });

        return result.success
            ? ErrorHandler.createSuccess(`User '${username}' registered. Home directory created.`)
            : ErrorHandler.createError(result.error.message || "Failed to register new user.");
    }


    async registerWithPrompt(username, options) {
        const { ErrorHandler } = this.dependencies;
        const formatValidation = this.dependencies.Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid) {
            return ErrorHandler.createError(formatValidation.error);
        }
        if (await this.userExists(username)) {
            return ErrorHandler.createError(`useradd: user '${username}' already exists`);
        }

        return new Promise((resolve) => {
            this.modalManager.request({
                context: "terminal",
                type: "input",
                messageLines: [`New password for ${username}:`],
                obscured: true,
                onConfirm: (password) => {
                    this.modalManager.request({
                        context: "terminal",
                        type: "input",
                        messageLines: ["Retype new password:"],
                        obscured: true,
                        onConfirm: async (confirmPassword) => {
                            if (password !== confirmPassword) {
                                resolve(ErrorHandler.createError("passwd: passwords do not match."));
                                return;
                            }
                            const result = await this.register(username, password);
                            resolve(result);
                        },
                        onCancel: () => resolve(ErrorHandler.createSuccess({ output: "useradd: user creation cancelled." })),
                        options,
                    });
                },
                onCancel: () => resolve(ErrorHandler.createSuccess({ output: "useradd: user creation cancelled." })),
                options,
            });
        });
    }

    async verifyPassword(username, password) {
        const { ErrorHandler } = this.dependencies;
        if (!await this.userExists(username)) return ErrorHandler.createError("User not found.");
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, password]));
        return result.success && result.data ? ErrorHandler.createSuccess() : ErrorHandler.createError("Incorrect password.");
    }

    async sudoExecute(commandStr, options) {
        const { ErrorHandler, SudoManager, ModalManager } = this.dependencies;
        const currentUserName = this.getCurrentUser().name;

        // Sudo logic now relies on a temporary context switch for execution
        if (currentUserName === 'root') {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        const canRun = JSON.parse(OopisOS_Kernel.syscall("sudo", "can_user_run_command", [currentUserName, this.groupManager.getGroupsForUser(currentUserName), commandStr.split(" ")[0]])).data;
        if (!canRun) {
            return ErrorHandler.createError(`sudo: user ${currentUserName} is not allowed to execute '${commandStr}' as root.`);
        }

        const authSuccess = SudoManager.isUserTimestampValid(currentUserName);
        if (authSuccess) {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        const userHasPassword = await this.hasPassword(currentUserName);
        if (!userHasPassword) {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        return new Promise(async (resolve) => {
            ModalManager.request({
                context: "terminal", type: "input",
                messageLines: [`[sudo] password for ${currentUserName}:`],
                obscured: true,
                onConfirm: async (password) => {
                    const verifyResult = await this.verifyPassword(currentUserName, password);
                    if (!verifyResult.success) {
                        resolve(ErrorHandler.createError("sudo: sorry, try again"));
                        return;
                    }
                    SudoManager.updateUserTimestamp(currentUserName);
                    const cmdResult = await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
                    resolve(cmdResult);
                },
                onCancel: () => resolve(ErrorHandler.createError("sudo: password entry cancelled.")),
                options,
            });
        });
    }


    async changePassword(actorUsername, targetUsername, oldPassword, newPassword) {
        const { ErrorHandler } = this.dependencies;
        if (!(await this.userExists(targetUsername))) return ErrorHandler.createError(`User '${targetUsername}' not found.`);
        if (actorUsername !== "root") {
            if (actorUsername !== targetUsername) return ErrorHandler.createError("You can only change your own password.");
            const authResult = await this.verifyPassword(actorUsername, oldPassword);
            if (!authResult.success) return ErrorHandler.createError("Incorrect current password.");
        }
        if (!newPassword || newPassword.trim() === "") return ErrorHandler.createError("New password cannot be empty.");

        const result = JSON.parse(OopisOS_Kernel.syscall("users", "change_password", [targetUsername, newPassword]));
        if (result.success && result.data) {
            this._saveUsers();
            return ErrorHandler.createSuccess(`Password for '${targetUsername}' updated successfully.`);
        }
        return ErrorHandler.createError("Failed to save updated password.");
    }

    async _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const { ErrorHandler, AuditManager, ModalManager, Config } = this.dependencies;
        const userResult = JSON.parse(OopisOS_Kernel.syscall("users", "get_user", [username]));
        if (!userResult.success || !userResult.data) {
            AuditManager.log(username, 'auth_failure', `Attempted login for non-existent user '${username}'.`);
            return ErrorHandler.createError(failureMessage);
        }

        // First, let's ask the kernel if this user even has a password.
        const userHasPassword = await this.hasPassword(username);
        if (!userHasPassword) {
            // If they don't have a password (like our dear friend 'Guest'),
            // authentication is automatically successful! No need to ask for a password.
            // Let's just proceed directly to the success callback. How efficient!
            return await successCallback(username, options);
        }

        // The rest of the function handles users who *do* have passwords.
        if (providedPassword === null && options?.isInteractive !== false) {
            return new Promise((resolve) => {
                ModalManager.request({
                    context: "terminal", type: "input", messageLines: [Config.MESSAGES.PASSWORD_PROMPT], obscured: true,
                    onConfirm: async (passwordFromPrompt) => {
                        const verifyResult = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, passwordFromPrompt || ""]));
                        if (verifyResult.success && verifyResult.data) {
                            resolve(await successCallback(username, options));
                        } else {
                            AuditManager.log(username, 'auth_failure', `Failed login attempt for user '${username}'.`);
                            resolve(ErrorHandler.createError(failureMessage));
                        }
                    },
                    onCancel: () => resolve(ErrorHandler.createError(Config.MESSAGES.OPERATION_CANCELLED)),
                    options,
                });
            });
        }

        const verifyResult = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, providedPassword]));
        if (verifyResult.success && verifyResult.data) {
            return await successCallback(username, options);
        } else {
            const context = options?.isInteractive === false ? 'non-interactive' : 'interactive';
            AuditManager.log(username, 'auth_failure', `Failed ${context} login for '${username}'.`);
            return ErrorHandler.createError(failureMessage);
        }
    }


    async login(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        if (username === this.getCurrentUser().name) {
            return ErrorHandler.createSuccess(`${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`, { noAction: true });
        }
        return this._handleAuthFlow(username, providedPassword, this._performLogin.bind(this), "Login failed.", options);
    }

    async _performLogin(username, options) {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager } = this.dependencies;
        const oldUser = this.getCurrentUser().name;
        if (oldUser !== this.config.USER.DEFAULT_NAME) {
            SessionManager.saveAutomaticState(oldUser);
            this.sudoManager.clearUserTimestamp(oldUser);
        }
        SessionManager.clearUserStack(username);
        const sessionStatus = await SessionManager.loadAutomaticState(username);
        EnvironmentManager.initialize();
        AuditManager.log(username, 'login_success', `User logged in successfully.`);
        return ErrorHandler.createSuccess(`Logged in as ${username}.`, { isLogin: true, shouldWelcome: sessionStatus.newStateCreated });
    }

    /**
     * Initiates the user substitution process.
     * @param {string} username - The target username to switch to.
     * @param {string|null} providedPassword - The password, if provided on the command line.
     * @param {object} options - Command execution options.
     * @returns {Promise<object>} The result of the operation.
     */
    async su(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        if (username === this.getCurrentUser().name) {
            return ErrorHandler.createSuccess(`Already user ${username}.`, { noAction: true });
        }
        // We can reuse our awesome, secure authentication flow! How efficient!
        return this._handleAuthFlow(username, providedPassword, this._performSu.bind(this), "su: Authentication failure.", options);
    }

    /**
     * Executes the actual user substitution after successful authentication.
     * This is the core of the identity swap.
     * @private
     * @param {string} username - The username to become.
     * @param {object} options - Command execution options.
     * @returns {Promise<object>} A success object from the ErrorHandler.
     */
    async _performSu(username, options) {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager, TerminalUI } = this.dependencies;
        const oldUser = this.getCurrentUser().name;

        // 1. Save the state of the user we're leaving.
        SessionManager.saveAutomaticState(oldUser);
        this.sudoManager.clearUserTimestamp(oldUser);

        // 2. Log this important security event.
        AuditManager.log(oldUser, 'su_success', `Switched to user '${username}'.`);

        // 3. The Metamorphosis: Push the new user onto the session stack.
        SessionManager.pushUserToStack(username);

        // 4. Load the new user's environment, history, etc.
        await SessionManager.loadAutomaticState(username);
        EnvironmentManager.initialize(); // This updates ENV vars like USER and HOME
        TerminalUI.updatePrompt(); // And this makes the prompt look right!

        return ErrorHandler.createSuccess("", { shouldWelcome: false }); // No welcome message needed for su
    }

    /**
     * Handles the logout process. If the user is in an 'su' session (stack depth > 1),
     * it pops the current user off the stack, reverting to the previous user.
     * Otherwise, it prevents logging out from the base session.
     * @returns {Promise<object>} A success or error object from the ErrorHandler.
     */
    async logout() {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager, TerminalUI, FileSystemManager, Config } = this.dependencies;
        const oldUser = this.getCurrentUser().name;

        // Check the session stack depth. This is the key to our new logic!
        if (SessionManager.getStack().length <= 1) {
            // Prevent logging out from the base session.
            return ErrorHandler.createSuccess(`Cannot log out from user '${oldUser}'. This is the only active session. Use 'login <username>' to switch users.`, { noAction: true });
        }

        // 1. Save the state of the user we're leaving.
        SessionManager.saveAutomaticState(oldUser);
        this.sudoManager.clearUserTimestamp(oldUser);

        // 2. The Reversion: Pop the current user from the session stack.
        SessionManager.popUserFromStack();
        const newUsername = SessionManager.getCurrentUserFromStack();

        // 3. Log the event for our records.
        AuditManager.log(oldUser, 'su_exit', `Reverted from user '${oldUser}' to '${newUsername}'.`);

        // 4. Load the state of the user we are returning to.
        await SessionManager.loadAutomaticState(newUsername);
        EnvironmentManager.initialize();
        TerminalUI.updatePrompt();

        const homePath = `/home/${newUsername}`;
        const homeNode = await FileSystemManager.getNodeByPath(homePath);
        FileSystemManager.setCurrentPath(homeNode ? homePath : Config.FILESYSTEM.ROOT_PATH);

        // Unlike a full login, we don't show a big welcome message here. Just a simple confirmation.
        return ErrorHandler.createSuccess(`logout`, { isLogout: true, newUser: newUsername });
    }


    async initializeDefaultUsers() {
        const { OutputManager, Config } = this.dependencies;
        const usersFromStorage = this.storageManager.loadItem(this.config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});

        OopisOS_Kernel.syscall("users", "load_users", [usersFromStorage]);
        OopisOS_Kernel.syscall("users", "initialize_defaults", [Config.USER.DEFAULT_NAME]);

        const guestHomePath = `/home/${Config.USER.DEFAULT_NAME}`;
        const guestHomeNode = await this.dependencies.FileSystemManager.getNodeByPath(guestHomePath);
        if (!guestHomeNode) {
            await this.sudoExecute(`mkdir ${guestHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chown ${Config.USER.DEFAULT_NAME} ${guestHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chgrp ${Config.USER.DEFAULT_NAME} ${guestHomePath}`, { isInteractive: false });
        }

        const rootResult = JSON.parse(OopisOS_Kernel.syscall("users", "get_user", ['root']));
        const rootNeedsPassword = rootResult.success && rootResult.data && !rootResult.data.passwordData;

        const usersResult = JSON.parse(OopisOS_Kernel.syscall("users", "get_all_users"));
        const allUsers = usersResult.success ? usersResult.data : {};
        if (Object.keys(allUsers).length > Object.keys(usersFromStorage).length) {
            this._saveUsers();
        }
    }

    async performFirstTimeSetup(userData) {
        const { username, password, rootPassword } = userData;
        const { ErrorHandler } = this.dependencies;

        const resultJson = OopisOS_Kernel.syscall("users", "first_time_setup", [username, password, rootPassword]);
        const result = JSON.parse(resultJson);

        if (result.success) {
            this._saveUsers();
            this.groupManager._save();
            return ErrorHandler.createSuccess();
        } else {
            return ErrorHandler.createError(result.error || "An unknown error occurred during first-time setup.");
        }
    }
}