// gem/scripts/user_manager.js

/**
 * @class UserManager
 * @classdesc An API client for the OopisOS Python User Manager kernel.
 * All core logic and state for user accounts are now handled by `core/users.py`.
 * This JavaScript class remains as a bridge to handle UI interactions (like password prompts)
 * and to sync data between the Python kernel and browser storage.
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
        // The JS `currentUser` is now just a lightweight reflection of the Python state.
        this.currentUser = { name: this.config.USER.DEFAULT_NAME };
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.userManager;
        }
        throw new Error("Python kernel for UserManager is not available.");
    }

    setDependencies(sessionManager, sudoManager, commandExecutor, modalManager) {
        this.sessionManager = sessionManager;
        this.sudoManager = sudoManager;
        this.commandExecutor = commandExecutor;
        this.modalManager = modalManager;
    }

    _saveUsers() {
        const allUsers = this._getManager().get_all_users().toJs({ dict_converter: Object.fromEntries });
        this.storageManager.saveItem(this.config.STORAGE_KEYS.USER_CREDENTIALS, allUsers, "User list");
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getPrimaryGroupForUser(username) {
        const user = this._getManager().get_user(username);
        if (user) {
            const primaryGroup = user.get('primaryGroup');
            user.destroy();
            return primaryGroup;
        }
        return null;
    }

    async userExists(username) {
        return this._getManager().user_exists(username);
    }

    async register(username, password) {
        const { Utils, ErrorHandler } = this.dependencies;
        const formatValidation = Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid) {
            return ErrorHandler.createError(formatValidation.error);
        }
        if (await this.userExists(username)) {
            return ErrorHandler.createError(`User '${username}' already exists.`);
        }

        // Create group first in JS to ensure it's saved correctly
        this.groupManager.createGroup(username);
        this.groupManager.addUserToGroup(username, username);

        const result = this._getManager().register_user(username, password, username).toJs({ dict_converter: Object.fromEntries });

        if (result.success) {
            this._saveUsers();
            await this.fsManager.createUserHomeDirectory(username);
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

        const isValid = this._getManager().verify_password(username, password);

        return isValid
            ? ErrorHandler.createSuccess()
            : ErrorHandler.createError("Incorrect password.");
    }

    async sudoExecute(commandStr, options) {
        const { ErrorHandler } = this.dependencies;
        const originalUser = this.currentUser;
        try {
            this.currentUser = { name: "root" };
            // This is a special case where we modify the JS-side currentUser for the duration of the command
            return await this.commandExecutor.processSingleCommand(
                commandStr,
                options
            );
        } catch (e) {
            return ErrorHandler.createError(
                `sudo: an unexpected error occurred during execution: ${e.message}`
            );
        } finally {
            this.currentUser = originalUser;
        }
    }

    async changePassword(actorUsername, targetUsername, oldPassword, newPassword) {
        const { ErrorHandler } = this.dependencies;

        if (!(await this.userExists(targetUsername))) {
            return ErrorHandler.createError(`User '${targetUsername}' not found.`);
        }
        if (actorUsername !== "root") {
            if (actorUsername !== targetUsername) {
                return ErrorHandler.createError(
                    "You can only change your own password."
                );
            }
            const authResult = await this.verifyPassword(
                actorUsername,
                oldPassword
            );
            if (!authResult.success) {
                return ErrorHandler.createError("Incorrect current password.");
            }
        }
        if (!newPassword || newPassword.trim() === "") {
            return ErrorHandler.createError("New password cannot be empty.");
        }

        const result = this._getManager().change_password(targetUsername, newPassword);

        if (result) {
            this._saveUsers();
            return ErrorHandler.createSuccess(
                `Password for '${targetUsername}' updated successfully.`
            );
        }
        return ErrorHandler.createError("Failed to save updated password.");
    }

    async _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const { ErrorHandler } = this.dependencies;

        const userEntry = this._getManager().get_user(username);
        const hasPassword = userEntry && userEntry.get('passwordData');
        if (userEntry) userEntry.destroy();

        if (hasPassword) {
            if (providedPassword !== null) {
                if (this._getManager().verify_password(username, providedPassword)) {
                    return await successCallback(username);
                } else {
                    return ErrorHandler.createError(this.config.MESSAGES.INVALID_PASSWORD);
                }
            } else {
                return new Promise((resolve) => {
                    this.modalManager.request({
                        context: "terminal",
                        type: "input",
                        messageLines: [this.config.MESSAGES.PASSWORD_PROMPT],
                        obscured: true,
                        onConfirm: async (passwordFromPrompt) => {
                            if (this._getManager().verify_password(username, passwordFromPrompt)) {
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
        } else {
            if (providedPassword !== null) {
                return ErrorHandler.createError("This account does not require a password.");
            }
            return await successCallback(username);
        }
    }


    async login(username, providedPassword, options = {}) {
        // ... (logic remains mostly the same, but now it will call the python-backed _handleAuthFlow)
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

        this.dependencies.AuditManager.log(username, 'login_success', `User logged in successfully.`);
        return ErrorHandler.createSuccess({
            message: `Logged in as ${username}.`,
            isLogin: true,
        });
    }

    async su(username, providedPassword, options = {}) {
        // ... (logic remains mostly the same, but now it will call the python-backed _handleAuthFlow)
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
        await this.sessionManager.loadAutomaticState(username);

        this.dependencies.AuditManager.log(this.getCurrentUser().name, 'su_success', `Switched to user: ${username}.`);
        return ErrorHandler.createSuccess({
            message: `Switched to user: ${username}.`,
        });
    }

    async logout() {
        // This logic is mostly JS-side as it deals with JS session state objects
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
        const { OutputManager, Config, Utils } = this.dependencies;
        const usersFromStorage = this.storageManager.loadItem(
            this.config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {}
        );

        this._getManager().load_users(usersFromStorage);
        this._getManager().initialize_defaults(Config.USER.DEFAULT_NAME);

        // Check if root password needs to be set for the first time
        const rootUser = this._getManager().get_user('root');
        const rootNeedsPassword = !rootUser || !rootUser.get('passwordData');
        if(rootUser) rootUser.destroy();

        let changesMade = false;
        if (rootNeedsPassword) {
            const randomPassword = Math.random().toString(36).slice(-8);
            const { salt, hash } = await this._secureHashPassword(randomPassword);
            const passwordData = { salt, hash };

            const users = this._getManager().get_all_users().toJs({ dict_converter: Object.fromEntries });
            users['root']['passwordData'] = passwordData;
            this._getManager().load_users(users);

            setTimeout(() => {
                OutputManager.appendToOutput(
                    `IMPORTANT: Your one-time root password is: ${randomPassword}`,
                    { typeClass: Config.CSS_CLASSES.WARNING_MSG }
                );
                OutputManager.appendToOutput(
                    `Please save it securely or change it immediately using 'passwd'.`,
                    { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
                );
            }, 500);
            changesMade = true;
        }

        const allUsers = this._getManager().get_all_users().toJs({ dict_converter: Object.fromEntries });
        const userCount = Object.keys(allUsers).length;
        const storageCount = Object.keys(usersFromStorage).length;
        if (userCount > storageCount) {
            changesMade = true;
        }

        if (changesMade) {
            this._saveUsers();
        }
    }
}