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

    async syncAndSave(usersData) {
        const { StorageManager, Config } = this.dependencies;
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, usersData, "User Credentials");
        await OopisOS_Kernel.syscall("users", "load_users", [usersData]);
    }
}