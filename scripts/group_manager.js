// gem/scripts/group_manager.js

/**
 * @class GroupManager
 * @classdesc An API client for the OopisOS Python Group Manager kernel.
 * All core logic and state for group management are now handled by `core/groups.py`.
 */
class GroupManager {
    constructor() {
        this.dependencies = {};
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    async initialize() {
        const { StorageManager, Config } = this.dependencies;
        const groupsFromStorage = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            null
        );

        if (groupsFromStorage) {
            await OopisOS_Kernel.syscall("groups", "load_groups", [groupsFromStorage]);
        } else {
            await OopisOS_Kernel.syscall("groups", "initialize_defaults");
        }
        await this._save(); // Save back to storage to ensure consistency
        console.log("GroupManager initialized and synced with Python kernel.");
    }

    async _save() {
        const { StorageManager, Config } = this.dependencies;
        const allGroups = await this.getAllGroups();
        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            allGroups,
            "User Groups"
        );
    }

    /**
     * Takes an updated group state object from a Python effect, syncs it with
     * the Python kernel's state (just to be safe), and saves it to localStorage.
     * @param {object} groupsData The complete groups object from the Python kernel.
     */
    async syncAndSave(groupsData) {
        const { StorageManager, Config } = this.dependencies;
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_GROUPS, groupsData, "User Groups");
        await OopisOS_Kernel.syscall("groups", "load_groups", [groupsData]);
    }

    async getAllGroups() {
        try {
            const resultJson = await OopisOS_Kernel.syscall("groups", "get_all_groups");
            const result = JSON.parse(resultJson);
            if (result.success) {
                return result.data;
            }
            console.error("Failed to get all groups from kernel:", result.error);
            return {};
        } catch (e) {
            console.error(e);
            return {};
        }
    }

    async groupExists(groupName) {
        const resultJson = await OopisOS_Kernel.syscall("groups", "group_exists", [groupName]);
        const result = JSON.parse(resultJson);
        return result.success ? result.data : false;
    }

    async createGroup(groupName) {
        const resultJson = await OopisOS_Kernel.syscall("groups", "create_group", [groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            await this._save();
            return true;
        }
        return false;
    }

    async addUserToGroup(username, groupName) {
        const resultJson = await OopisOS_Kernel.syscall("groups", "add_user_to_group", [username, groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            await this._save();
            return true;
        }
        return false;
    }

    async getGroupsForUser(username) {
        const { StorageManager, Config } = this.dependencies;
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        const primaryGroup = users[username]?.primaryGroup;
        const allGroups = await this.getAllGroups();
        const userGroups = [];

        if (primaryGroup && !userGroups.includes(primaryGroup)) {
            userGroups.push(primaryGroup);
        }

        for (const groupName in allGroups) {
            if (
                allGroups[groupName].members &&
                allGroups[groupName].members.includes(username) &&
                !userGroups.includes(groupName)
            ) {
                userGroups.push(groupName);
            }
        }
        return userGroups;
    }

    async deleteGroup(groupName) {
        const resultJson = await OopisOS_Kernel.syscall("groups", "delete_group", [groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            await this._save();
            return { success: true };
        }
        return { success: false, error: `group '${groupName}' does not exist.` };
    }

    async removeUserFromAllGroups(username) {
        const resultJson = await OopisOS_Kernel.syscall("groups", "remove_user_from_all_groups", [username]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            await this._save();
        }
    }
}