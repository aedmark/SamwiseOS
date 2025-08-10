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
        this.currentUser = { name: this.config.USER.DEFAULT_NAME };
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

    getCurrentUser() {
        return this.currentUser;
    }

    getPrimaryGroupForUser(username) {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "get_user", [username]));
        return (result.success && result.data) ? result.data.primaryGroup : null;
    }

    async userExists(username) {
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "user_exists", [username]));
        return result.success && result.data;
    }

    async register(username, password) {
        const { Utils, ErrorHandler } = this.dependencies;
        const formatValidation = Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid) return ErrorHandler.createError(formatValidation.error);
        if (await this.userExists(username)) return ErrorHandler.createError(`User '${username}' already exists.`);

        this.groupManager.createGroup(username);
        this.groupManager.addUserToGroup(username, username);

        const result = JSON.parse(OopisOS_Kernel.syscall("users", "register_user", [username, password, username]));

        if (result.success) {
            this._saveUsers();
            await this.sudoExecute(`mkdir /home/${username}`, { isInteractive: false });
            await this.sudoExecute(`chown ${username} /home/${username}`, { isInteractive: false });
            await this.sudoExecute(`chgrp ${username} /home/${username}`, { isInteractive: false });
            return ErrorHandler.createSuccess(
                `User '${username}' registered. Home directory created at /home/${username}.`,
                { stateModified: true }
            );
        }
        return ErrorHandler.createError(result.error || "Failed to register new user in kernel.");
    }

    async verifyPassword(username, password) {
        const { ErrorHandler } = this.dependencies;
        if (!await this.userExists(username)) return ErrorHandler.createError("User not found.");
        const result = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, password]));
        return result.success && result.data ? ErrorHandler.createSuccess() : ErrorHandler.createError("Incorrect password.");
    }

    async sudoExecute(commandStr, options) {
        // This is a JS-side concern, no syscall changes needed here.
        const { ErrorHandler } = this.dependencies;
        const originalUser = this.currentUser;
        try {
            this.currentUser = { name: "root" };
            return await this.commandExecutor.processSingleCommand(commandStr, options);
        } catch (e) {
            return ErrorHandler.createError(`sudo: an unexpected error occurred during execution: ${e.message}`);
        } finally {
            this.currentUser = originalUser;
        }
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

    // _handleAuthFlow and its callers (login, su, logout) are primarily JS-side logic
    // orchestrating the UI and session state. They already use the public API methods
    // that we've refactored, so no major changes are needed inside them.
    async _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const { ErrorHandler } = this.dependencies;

        if (providedPassword !== null) {
            // If password was provided via args (e.g., `su root pa$$word`)
            const verifyResult = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, providedPassword]));
            if (verifyResult.success && verifyResult.data) {
                return await successCallback(username);
            } else {
                this.dependencies.AuditManager.log(username, 'auth_failure', `Failed login attempt for user '${username}'.`);
                return ErrorHandler.createError(failureMessage);
            }
        } else {
            // If no password was provided, we MUST prompt. Python will tell us if it's okay to be empty.
            return new Promise((resolve) => {
                this.modalManager.request({
                    context: "terminal", type: "input", messageLines: [this.config.MESSAGES.PASSWORD_PROMPT], obscured: true,
                    onConfirm: async (passwordFromPrompt) => {
                        // An empty string is a valid attempt for users without a password.
                        const verifyResult = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, passwordFromPrompt || ""]));
                        if (verifyResult.success && verifyResult.data) {
                            resolve(await successCallback(username));
                        } else {
                            this.dependencies.AuditManager.log(username, 'auth_failure', `Failed login attempt for user '${username}'.`);
                            resolve(ErrorHandler.createError(failureMessage));
                        }
                    },
                    onCancel: () => resolve(ErrorHandler.createSuccess({ output: this.config.MESSAGES.OPERATION_CANCELLED })),
                    options,
                });
            });
        }
    }

    async login(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const currentUserName = this.getCurrentUser().name;
        if (username === currentUserName) {
            return ErrorHandler.createSuccess({
                message: `${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`,
                noAction: true,
            });
        }
        return this._handleAuthFlow(
            username,
            providedPassword,
            this._performLogin.bind(this),
            "Login failed.",
            options
        );
    }

    async _performLogin(username) {
        const { ErrorHandler } = this.dependencies;
        if (this.currentUser.name !== this.config.USER.DEFAULT_NAME) {
            this.sessionManager.saveAutomaticState(this.currentUser.name);
            this.sudoManager.clearUserTimestamp(this.currentUser.name);
        }
        this.sessionManager.clearUserStack(username);
        this.currentUser = { name: username };
        await this.sessionManager.loadAutomaticState(username);
        const sessionStatus = await this.sessionManager.loadAutomaticState(username);

        this.dependencies.AuditManager.log(username, 'login_success', `User logged in successfully.`);
        return this.dependencies.ErrorHandler.createSuccess({
            message: `Logged in as ${username}.`,
            isLogin: true,
            // [MODIFIED] Pass the crucial flag upwards
            shouldWelcome: sessionStatus.newStateCreated,
        });
    }

    async su(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const currentUserName = this.getCurrentUser().name;
        if (username === currentUserName) {
            return ErrorHandler.createSuccess({
                message: `Already user '${username}'.`,
                noAction: true,
            });
        }

        return this._handleAuthFlow(
            username,
            providedPassword,
            this._performSu.bind(this),
            "su: Authentication failure.",
            options
        );
    }

    async _performSu(username) {
        const { ErrorHandler } = this.dependencies;
        this.sessionManager.saveAutomaticState(this.currentUser.name);
        this.sessionManager.pushUserToStack(username);
        this.currentUser = { name: username };
        const sessionStatus = await this.sessionManager.loadAutomaticState(username);

        this.dependencies.AuditManager.log(this.getCurrentUser().name, 'su_success', `Switched to user: ${username}.`);
        return this.dependencies.ErrorHandler.createSuccess({
            message: `Switched to user: ${username}.`,
            // Pass the crucial flag upwards
            shouldWelcome: sessionStatus.newStateCreated,
        });
    }

    async logout() {
        const { ErrorHandler } = this.dependencies;
        const oldUser = this.currentUser.name;
        if (this.sessionManager.getStack().length <= 1) {
            return ErrorHandler.createSuccess({
                message: `Cannot log out from user '${oldUser}'. This is the only active session. Use 'login' to switch to a different user.`,
                noAction: true,
            });
        }
        this.sessionManager.saveAutomaticState(oldUser);
        this.sudoManager.clearUserTimestamp(oldUser);
        this.sessionManager.popUserFromStack();
        const newUsername = this.sessionManager.getCurrentUserFromStack();
        this.currentUser = { name: newUsername };
        this.sessionManager.loadAutomaticState(newUsername);
        const homePath = `/home/${newUsername}`;
        const homeNode = await this.fsManager.getNodeByPath(homePath);
        this.fsManager.setCurrentPath(
            homeNode ? homePath : this.config.FILESYSTEM.ROOT_PATH
        );
        return ErrorHandler.createSuccess({
            message: `Logged out from ${oldUser}. Now logged in as ${newUsername}.`,
            isLogout: true,
            newUser: newUsername,
        });
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

        // Onboarding flow will handle this now, so we can remove the one-time password generation.
        // This makes the system more secure as it won't boot into a usable state
        // with a printed root password anymore.

        const usersResult = JSON.parse(OopisOS_Kernel.syscall("users", "get_all_users"));
        const allUsers = usersResult.success ? usersResult.data : {};
        if (Object.keys(allUsers).length > Object.keys(usersFromStorage).length) {
            this._saveUsers();
        }
    }

    async performFirstTimeSetup(userData) {
        const { username, password, rootPassword } = userData;
        const { ErrorHandler, FileSystemManager } = this.dependencies;

        const resultJson = OopisOS_Kernel.syscall("users", "first_time_setup", [username, password, rootPassword]);
        const result = JSON.parse(resultJson);

        if (result.success) {
            // After Python does the heavy lifting, we need to sync the JS-side state
            // and save the results to localStorage and IndexedDB.
            this._saveUsers();
            this.groupManager._save();
            await FileSystemManager.save();
            return ErrorHandler.createSuccess();
        } else {
            return ErrorHandler.createError(result.error || "An unknown error occurred during first-time setup.");
        }
    }
}