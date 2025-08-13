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

    syncAndSave(usersData) {
        const { StorageManager, Config } = this.dependencies;
        // The data from the effect is the new source of truth.
        // 1. Save it to localStorage so it persists across sessions.
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, usersData, "User list");
        // 2. Ensure Python's in-memory state is identical to what we're saving.
        OopisOS_Kernel.syscall("users", "load_users", [usersData]);
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

        const result = JSON.parse(OopisOS_Kernel.syscall("users", "register_user", [username, password, username]));

        if (result.success) {
            this._saveUsers();
            // When root runs useradd, we're already root, so no password needed for these sudo commands.
            const sudoOptions = { isInteractive: false };

            await this.sudoExecute(`mkdir /home/${username}`, sudoOptions);
            await this.sudoExecute(`chown ${username} /home/${username}`, sudoOptions);
            await this.sudoExecute(`chgrp ${username} /home/${username}`, sudoOptions);
            return ErrorHandler.createSuccess(
                `User '${username}' registered. Home directory created at /home/${username}.`,
                { stateModified: true }
            );
        }
        return ErrorHandler.createError(result.error || "Failed to register new user in kernel.");
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

        if (currentUserName === 'root') {
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

        const authSuccess = SudoManager.isUserTimestampValid(currentUserName);

        if (authSuccess) {
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

        const userHasPassword = await this.hasPassword(currentUserName);

        if (!userHasPassword) {
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

        return new Promise(async (resolve) => {
            const handleSudoAuth = async (password) => {
                const verifyResult = await this.verifyPassword(currentUserName, password);
                if (!verifyResult.success) {
                    resolve(ErrorHandler.createError("sudo: sorry, try again"));
                    return;
                }
                SudoManager.updateUserTimestamp(currentUserName);
                const originalUser = this.currentUser;
                try {
                    this.currentUser = { name: "root" };
                    const cmdResult = await this.commandExecutor.processSingleCommand(commandStr, options);
                    resolve(cmdResult);
                } catch (e) {
                    resolve(ErrorHandler.createError(`sudo: an unexpected error occurred during execution: ${e.message}`));
                } finally {
                    this.currentUser = originalUser;
                }
            };

            if (options.password) {
                await handleSudoAuth(options.password);
            } else {
                ModalManager.request({
                    context: "terminal",
                    type: "input",
                    messageLines: [`[sudo] password for ${currentUserName}:`],
                    obscured: true,
                    onConfirm: handleSudoAuth,
                    onCancel: () => resolve(ErrorHandler.createError("sudo: password entry cancelled.")),
                    options,
                });
            }
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

        if (providedPassword === null && options?.isInteractive !== false) {
            return new Promise((resolve) => {
                ModalManager.request({
                    context: "terminal", type: "input", messageLines: [Config.MESSAGES.PASSWORD_PROMPT], obscured: true,
                    onConfirm: async (passwordFromPrompt) => {
                        const verifyResult = JSON.parse(OopisOS_Kernel.syscall("users", "verify_password", [username, passwordFromPrompt || ""]));
                        if (verifyResult.success && verifyResult.data) {
                            resolve(await successCallback(username));
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
            return await successCallback(username);
        } else {
            const context = options?.isInteractive === false ? 'non-interactive' : 'interactive';
            AuditManager.log(username, 'auth_failure', `Failed ${context} login for '${username}'.`);
            return ErrorHandler.createError(failureMessage);
        }
    }


    async login(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const currentUserName = this.getCurrentUser().name;
        if (username === currentUserName) {
            return ErrorHandler.createSuccess(
                `${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`,
                { noAction: true }
            );
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
        if (this.currentUser.name !== this.config.USER.DEFAULT_NAME) {
            this.sessionManager.saveAutomaticState(this.currentUser.name);
            this.sudoManager.clearUserTimestamp(this.currentUser.name);
        }
        this.sessionManager.clearUserStack(username);
        this.currentUser = { name: username };
        const sessionStatus = await this.sessionManager.loadAutomaticState(username);

        this.dependencies.AuditManager.log(username, 'login_success', `User logged in successfully.`);
        return this.dependencies.ErrorHandler.createSuccess(
            `Logged in as ${username}.`,
            {
                isLogin: true,
                shouldWelcome: sessionStatus.newStateCreated,
            }
        );
    }

    async su(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const currentUserName = this.getCurrentUser().name;
        if (username === currentUserName) {
            return ErrorHandler.createSuccess(
                `Already user '${username}'.`,
                { noAction: true }
            );
        }

        // If the current user is root, bypass the authentication flow.
        if (currentUserName === 'root') {
            if (!(await this.userExists(username))) {
                return ErrorHandler.createError(`su: user ${username} does not exist`);
            }
            return await this._performSu(username);
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
        this.sessionManager.saveAutomaticState(this.currentUser.name);
        this.sessionManager.pushUserToStack(username);
        this.currentUser = { name: username };
        const sessionStatus = await this.sessionManager.loadAutomaticState(username);

        this.dependencies.AuditManager.log(this.getCurrentUser().name, 'su_success', `Switched to user: ${username}.`);
        return this.dependencies.ErrorHandler.createSuccess(
            `Switched to user: ${username}.`,
            {
                shouldWelcome: sessionStatus.newStateCreated,
            }
        );
    }

    async logout() {
        const { ErrorHandler } = this.dependencies;
        const oldUser = this.currentUser.name;

        if (this.sessionManager.getStack().length <= 1) {
            return ErrorHandler.createSuccess(
                `Cannot log out from user '${oldUser}'. This is the only active session. Use 'login' to switch to a different user.`,
                {
                    noAction: true,
                }
            );
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

        return ErrorHandler.createSuccess(
            `Logged out from ${oldUser}. Now logged in as ${newUsername}.`,
            {
                isLogout: true,
                newUser: newUsername,
            }
        );
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