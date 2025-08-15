// gemini/scripts/user_manager.js
class UserManager {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.currentUser = null;
    }

    setDependencies(sessionManager, sudoManager, commandExecutor, modalManager) {
        this.dependencies.SessionManager = sessionManager;
        this.dependencies.SudoManager = sudoManager;
        this.dependencies.CommandExecutor = commandExecutor;
        this.dependencies.ModalManager = modalManager;
    }

    async initializeDefaultUsers() {
        const { StorageManager, Config } = this.dependencies;
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list");
        if (!users) {
            await OopisOS_Kernel.syscall("users", "initialize_defaults", [Config.USER.DEFAULT_NAME]);
        }
        const usersFromStorage = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        await OopisOS_Kernel.syscall("users", "load_users", [usersFromStorage]);
    }

    async getCurrentUser() {
        const username = await this.dependencies.SessionManager.getCurrentUserFromStack();
        const primaryGroup = await this.getPrimaryGroupForUser(username);
        this.currentUser = { name: username, primaryGroup: primaryGroup };
        return this.currentUser;
    }

    async getPrimaryGroupForUser(username) {
        const { StorageManager, Config } = this.dependencies;
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        return users[username]?.primaryGroup || username;
    }

    async performFirstTimeSetup(userData) {
        const resultJson = await OopisOS_Kernel.syscall("users", "first_time_setup", [userData.username, userData.password, userData.rootPassword]);
        const result = JSON.parse(resultJson);
        return result;
    }

    async loginUser(username, password) {
        const { SessionManager, ModalManager, Config, OutputManager, TerminalUI, ErrorHandler } = this.dependencies;
        const currentUsername = await SessionManager.getCurrentUserFromStack();

        if (currentUsername === username) {
            return ErrorHandler.createError(`Already logged in as ${username}.`);
        }

        let finalPassword = password;
        const wasInteractive = password === null; // Track if we need to prompt
        const hasPasswordResult = JSON.parse(await OopisOS_Kernel.syscall("users", "has_password", [username]));

        if (!hasPasswordResult.success) {
            return ErrorHandler.createError(hasPasswordResult.error || `Could not check password status for ${username}.`);
        }
        const needsPassword = hasPasswordResult.data;

        // Only prompt for a password if one is needed AND one wasn't provided.
        if (needsPassword && password === null) {
            finalPassword = await new Promise((resolve) => {
                ModalManager.request({
                    context: 'terminal', type: 'input', messageLines: [`Password for ${username}:`],
                    obscured: true, onConfirm: (pwd) => resolve(pwd), onCancel: () => resolve(null),
                });
            });
            if (finalPassword === null) return ErrorHandler.createError("Login cancelled.");
        }

        const verifyResultJson = await OopisOS_Kernel.syscall("users", "verify_password", [username, finalPassword]);
        const verifyResult = JSON.parse(verifyResultJson);

        if (verifyResult.success && verifyResult.data) {
            await SessionManager.pushUserToStack(username);
            const sessionStatus = await SessionManager.loadAutomaticState(username);
            // Welcome the user only if a new session state was created for them.
            if (sessionStatus.newStateCreated) {
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }
            await TerminalUI.updatePrompt(); // <-- ADDED: Ensure prompt updates immediately
            return ErrorHandler.createSuccess();
        } else {
            // If the verification failed, it's either an invalid password or a required one wasn't provided.
            if (wasInteractive || password !== null) {
                // If we prompted interactively OR a password was provided on the command line and failed, it's invalid.
                return ErrorHandler.createError(Config.MESSAGES.INVALID_PASSWORD);
            }
            // Otherwise, it was a non-interactive attempt (like a script) that requires a password.
            return ErrorHandler.createError('Password required.');
        }
    }

    async syncUsersFromKernel() {
        const { StorageManager, Config } = this.dependencies;
        const resultJson = await OopisOS_Kernel.syscall("users", "get_all_users");
        const result = JSON.parse(resultJson);
        if (result.success) {
            StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, result.data, "User Credentials");
        } else {
            console.error("Failed to sync users from kernel:", result.error);
        }
    }
}