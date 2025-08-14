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

    async _saveUsers() {
        const resultJson = await OopisOS_Kernel.syscall("users", "get_all_users");
        const result = JSON.parse(resultJson);
        const allUsers = result.success ? result.data : {};
        this.storageManager.saveItem(this.config.STORAGE_KEYS.USER_CREDENTIALS, allUsers, "User list");
    }

    async syncAndSave(usersData) {
        const { StorageManager, Config } = this.dependencies;
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, usersData, "User list");
        await OopisOS_Kernel.syscall("users", "load_users", [usersData]);
    }

    async getCurrentUser() {
        const username = await this.sessionManager.getCurrentUserFromStack();
        return { name: username };
    }

    async getPrimaryGroupForUser(username) {
        const resultJson = await OopisOS_Kernel.syscall("users", "get_user", [username]);
        const result = JSON.parse(resultJson);
        return (result.success && result.data) ? result.data.primaryGroup : null;
    }

    async userExists(username) {
        const resultJson = await OopisOS_Kernel.syscall("users", "user_exists", [username]);
        const result = JSON.parse(resultJson);
        return result.success && result.data;
    }

    async hasPassword(username) {
        const resultJson = await OopisOS_Kernel.syscall("users", "has_password", [username]);
        const result = JSON.parse(resultJson);
        return result.success && result.data;
    }

    async register(username, password) {
        const { Utils, ErrorHandler, CommandExecutor } = this.dependencies;
        const formatValidation = Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid) return ErrorHandler.createError(formatValidation.error);
        if (await this.userExists(username)) return ErrorHandler.createError(`User '${username}' already exists.`);

        await this.groupManager.createGroup(username);
        await this.groupManager.addUserToGroup(username, username);

        const registrationResultJson = await OopisOS_Kernel.syscall("users", "register_user", [username, password, username]);
        const registrationResult = JSON.parse(registrationResultJson);

        if (!registrationResult.success) {
            return ErrorHandler.createError(registrationResult.error || "Failed to register new user in kernel.");
        }

        const allUsersResultJson = await OopisOS_Kernel.syscall("users", "get_all_users");
        const allUsersResult = JSON.parse(allUsersResultJson);
        if (allUsersResult.success) {
            await this.syncAndSave(allUsersResult.data);
        } else {
            return ErrorHandler.createError("User was registered, but failed to sync user list.");
        }

        const homePath = `/home/${username}`;
        await CommandExecutor.processSingleCommand(`mkdir -p ${homePath}`, { isInteractive: false, sudoContext: true });
        await CommandExecutor.processSingleCommand(`chown ${username} ${homePath}`, { isInteractive: false, sudoContext: true });
        await CommandExecutor.processSingleCommand(`chgrp ${username} ${homePath}`, { isInteractive: false, sudoContext: true });

        return ErrorHandler.createSuccess(`User '${username}' registered. Home directory created.`);
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

    async removeUserWithPrompt(username, removeHome, options) {
        const { ModalManager, ErrorHandler, GroupManager, AuditManager } = this.dependencies;

        if (username === 'root') {
            return ErrorHandler.createError("removeuser: cannot remove the root user.");
        }
        const currentUser = await this.getCurrentUser();
        if (username === currentUser.name) {
            return ErrorHandler.createError("removeuser: you cannot remove yourself.");
        }
        if (!(await this.userExists(username))) {
            return ErrorHandler.createError(`removeuser: user '${username}' does not exist.`);
        }

        const messageLines = [`Are you sure you want to permanently delete the user '${username}'?`];
        if (removeHome) {
            messageLines.push("This will also DELETE their home directory and all its contents.");
        }

        return new Promise(async (resolve) => {
            const confirmed = await new Promise(r => ModalManager.request({
                context: "terminal",
                type: "confirm",
                messageLines: messageLines,
                onConfirm: () => r(true),
                onCancel: () => r(false),
                options,
            }));

            if (confirmed) {
                const resultJson = await OopisOS_Kernel.syscall("users", "delete_user_and_data", [username, removeHome]);
                const result = JSON.parse(resultJson);

                if (result.success) {
                    await this._saveUsers();
                    await GroupManager._save();
                    AuditManager.log(this.getCurrentUser().name, 'removeuser_success', `Removed user '${username}'.`);
                    resolve(ErrorHandler.createSuccess(`User '${username}' has been removed.`));
                } else {
                    resolve(ErrorHandler.createError(`removeuser: ${result.error}`));
                }
            } else {
                resolve(ErrorHandler.createSuccess("User removal cancelled."));
            }
        });
    }

    async verifyPassword(username, password) {
        const { ErrorHandler } = this.dependencies;
        if (!await this.userExists(username)) return ErrorHandler.createError("User not found.");
        const resultJson = await OopisOS_Kernel.syscall("users", "verify_password", [username, password]);
        const result = JSON.parse(resultJson);
        return result.success && result.data ? ErrorHandler.createSuccess() : ErrorHandler.createError("Incorrect password.");
    }

    async sudoExecute(commandStr, options) {
        const { ErrorHandler, SudoManager, ModalManager } = this.dependencies;
        const currentUser = await this.getCurrentUser();
        const currentUserName = currentUser.name;

        if (currentUserName === 'root') {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        const commandName = commandStr.split(" ")[0];
        const canRunResult = await OopisOS_Kernel.syscall("sudo", "can_user_run_command", [currentUserName, await this.groupManager.getGroupsForUser(currentUserName), commandName]);
        const canRun = JSON.parse(canRunResult).data;
        if (!canRun) {
            return ErrorHandler.createError(`sudo: user ${currentUserName} is not allowed to execute '${commandStr}' as root.`);
        }

        if (SudoManager.isUserTimestampValid(currentUserName)) {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        const userHasPassword = await this.hasPassword(currentUserName);
        if (!userHasPassword) {
            return await this.commandExecutor.processSingleCommand(commandStr, { ...options, sudoContext: true });
        }

        if (options.password) {
            const verifyResult = await this.verifyPassword(currentUserName, options.password);
            if (!verifyResult.success) {
                return ErrorHandler.createError("sudo: sorry, try again");
            }
            SudoManager.updateUserTimestamp(currentUserName);
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

        const resultJson = await OopisOS_Kernel.syscall("users", "change_password", [targetUsername, newPassword]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            await this._saveUsers();
            return ErrorHandler.createSuccess(`Password for '${targetUsername}' updated successfully.`);
        }
        return ErrorHandler.createError("Failed to save updated password.");
    }

    async _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const { ErrorHandler, AuditManager, ModalManager, Config } = this.dependencies;
        const userResultJson = await OopisOS_Kernel.syscall("users", "get_user", [username]);
        const userResult = JSON.parse(userResultJson);
        if (!userResult.success || !userResult.data) {
            AuditManager.log(username, 'auth_failure', `Attempted login for non-existent user '${username}'.`);
            return ErrorHandler.createError(failureMessage);
        }

        const userHasPassword = await this.hasPassword(username);
        if (!userHasPassword) {
            return await successCallback(username, options);
        }

        if (providedPassword === null && options?.isInteractive !== false) {
            return new Promise((resolve) => {
                ModalManager.request({
                    context: "terminal", type: "input", messageLines: [Config.MESSAGES.PASSWORD_PROMPT], obscured: true,
                    onConfirm: async (passwordFromPrompt) => {
                        const verifyResultJson = await OopisOS_Kernel.syscall("users", "verify_password", [username, passwordFromPrompt || ""]);
                        const verifyResult = JSON.parse(verifyResultJson);
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

        const verifyResultJson = await OopisOS_Kernel.syscall("users", "verify_password", [username, providedPassword]);
        const verifyResult = JSON.parse(verifyResultJson);
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
        const currentUser = await this.getCurrentUser();
        if (username === currentUser.name) {
            return ErrorHandler.createSuccess(`${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`, { noAction: true });
        }
        return this._handleAuthFlow(username, providedPassword, this._performLogin.bind(this), "Login failed.", options);
    }

    async _performLogin(username, options) {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager } = this.dependencies;
        const oldUser = await this.getCurrentUser();
        if (oldUser.name !== this.config.USER.DEFAULT_NAME) {
            await SessionManager.saveAutomaticState(oldUser.name);
            this.sudoManager.clearUserTimestamp(oldUser.name);
        }
        await SessionManager.clearUserStack(username);
        const sessionStatus = await SessionManager.loadAutomaticState(username);
        await EnvironmentManager.initialize();
        AuditManager.log(username, 'login_success', `User logged in successfully.`);
        return ErrorHandler.createSuccess(`Logged in as ${username}.`, { isLogin: true, shouldWelcome: sessionStatus.newStateCreated });
    }

    async su(username, providedPassword, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const currentUser = await this.getCurrentUser();
        if (username === currentUser.name) {
            return ErrorHandler.createSuccess(`Already user ${username}.`, { noAction: true });
        }
        return this._handleAuthFlow(username, providedPassword, this._performSu.bind(this), "su: Authentication failure.", options);
    }

    async _performSu(username, options) {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager, TerminalUI, FileSystemManager } = this.dependencies;
        const oldUser = await this.getCurrentUser();
        const oldCwd = this.dependencies.FileSystemManager.getCurrentPath();

        await SessionManager.saveAutomaticState(oldUser.name);
        this.sudoManager.clearUserTimestamp(oldUser.name);

        AuditManager.log(oldUser.name, 'su_success', `Switched to user '${username}'.`);
        await SessionManager.pushUserToStack(username);

        await SessionManager.loadAutomaticState(username);
        this.dependencies.FileSystemManager.setCurrentPath(oldCwd);
        await EnvironmentManager.initialize();
        await TerminalUI.updatePrompt();

        return ErrorHandler.createSuccess("", { shouldWelcome: false });
    }


    async logout() {
        const { ErrorHandler, AuditManager, SessionManager, EnvironmentManager, TerminalUI, FileSystemManager, Config } = this.dependencies;
        const oldUser = await this.getCurrentUser();
        const sessionStack = await SessionManager.getStack();

        if (sessionStack.length <= 1) {
            return ErrorHandler.createSuccess(`Cannot log out from user '${oldUser.name}'. This is the only active session. Use 'login <username>' to switch users.`, { noAction: true });
        }

        await SessionManager.saveAutomaticState(oldUser.name);
        this.sudoManager.clearUserTimestamp(oldUser.name);

        await SessionManager.popUserFromStack();
        const newUsername = await SessionManager.getCurrentUserFromStack();

        AuditManager.log(oldUser.name, 'su_exit', `Reverted from user '${oldUser.name}' to '${newUsername}'.`);
        await SessionManager.loadAutomaticState(newUsername);
        await EnvironmentManager.initialize();
        await TerminalUI.updatePrompt();

        const homePath = `/home/${newUsername}`;
        const homeNode = await FileSystemManager.getNodeByPath(homePath);
        await FileSystemManager.setCurrentPath(homeNode ? homePath : Config.FILESYSTEM.ROOT_PATH);

        return ErrorHandler.createSuccess(`logout`, { isLogout: true, newUser: newUsername });
    }

    async initializeDefaultUsers() {
        const { OutputManager, Config } = this.dependencies;
        const usersFromStorage = this.storageManager.loadItem(this.config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});

        await OopisOS_Kernel.syscall("users", "load_users", [usersFromStorage]);
        await OopisOS_Kernel.syscall("users", "initialize_defaults", [Config.USER.DEFAULT_NAME]);

        const guestHomePath = `/home/${Config.USER.DEFAULT_NAME}`;
        const guestHomeNode = await this.dependencies.FileSystemManager.getNodeByPath(guestHomePath);
        if (!guestHomeNode) {
            await this.sudoExecute(`mkdir ${guestHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chown ${Config.USER.DEFAULT_NAME} ${guestHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chgrp ${Config.USER.DEFAULT_NAME} ${guestHomePath}`, { isInteractive: false });
        }

        const rootHomePath = `/home/root`;
        const rootHomeNode = await this.dependencies.FileSystemManager.getNodeByPath(rootHomePath);
        if (!rootHomeNode) {
            await this.sudoExecute(`mkdir -p ${rootHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chown root ${rootHomePath}`, { isInteractive: false });
            await this.sudoExecute(`chgrp root ${rootHomePath}`, { isInteractive: false });
        }

        const rootResultJson = await OopisOS_Kernel.syscall("users", "get_user", ['root']);
        const rootResult = JSON.parse(rootResultJson);
        const rootNeedsPassword = rootResult.success && rootResult.data && !rootResult.data.passwordData;

        const usersResultJson = await OopisOS_Kernel.syscall("users", "get_all_users");
        const usersResult = JSON.parse(usersResultJson);
        const allUsers = usersResult.success ? usersResult.data : {};
        if (Object.keys(allUsers).length > Object.keys(usersFromStorage).length) {
            await this._saveUsers();
        }
    }

    async performFirstTimeSetup(userData) {
        const { username, password, rootPassword } = userData;
        const { ErrorHandler } = this.dependencies;

        const resultJson = await OopisOS_Kernel.syscall("users", "first_time_setup", [username, password, rootPassword]);
        const result = JSON.parse(resultJson);

        if (result.success) {
            await this._saveUsers();
            await this.dependencies.GroupManager._save();
            return ErrorHandler.createSuccess();
        } else {
            return ErrorHandler.createError(result.error || "An unknown error occurred during first-time setup.");
        }
    }
}