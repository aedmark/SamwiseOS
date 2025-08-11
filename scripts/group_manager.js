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

    initialize() {
        const { StorageManager, Config } = this.dependencies;
        const groupsFromStorage = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            null
        );

        if (groupsFromStorage) {
            // Use syscall to load initial state
            OopisOS_Kernel.syscall("groups", "load_groups", [groupsFromStorage]);
        } else {
            // Use syscall for default initialization
            OopisOS_Kernel.syscall("groups", "initialize_defaults");
        }
        this._save(); // Save back to storage to ensure consistency
        console.log("GroupManager initialized and synced with Python kernel.");
    }

    _save() {
        const { StorageManager, Config } = this.dependencies;
        const allGroups = this.getAllGroups();
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
    syncAndSave(groupsData) {
        const { StorageManager, Config } = this.dependencies;
        // The data from the effect is the new source of truth.
        // 1. Save it to localStorage so it persists across sessions.
        StorageManager.saveItem(Config.STORAGE_KEYS.USER_GROUPS, groupsData, "User Groups");
        // 2. Ensure Python's in-memory state is identical to what we're saving.
        OopisOS_Kernel.syscall("groups", "load_groups", [groupsData]);
    }

    getAllGroups() {
        try {
            // Use syscall to get all groups
            const resultJson = OopisOS_Kernel.syscall("groups", "get_all_groups");
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

    groupExists(groupName) {
        // Use syscall to check if a group exists
        const resultJson = OopisOS_Kernel.syscall("groups", "group_exists", [groupName]);
        const result = JSON.parse(resultJson);
        return result.success ? result.data : false;
    }

    createGroup(groupName) {
        // Use syscall to create a group
        const resultJson = OopisOS_Kernel.syscall("groups", "create_group", [groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            this._save();
            return true;
        }
        return false;
    }

    addUserToGroup(username, groupName) {
        // Use syscall to add a user to a group
        const resultJson = OopisOS_Kernel.syscall("groups", "add_user_to_group", [username, groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            this._save();
            return true;
        }
        return false;
    }

    getGroupsForUser(username) {
        const { StorageManager, Config } = this.dependencies;
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        const primaryGroup = users[username]?.primaryGroup;
        const allGroups = this.getAllGroups();
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

    deleteGroup(groupName) {
        //  Use syscall to delete a group
        const resultJson = OopisOS_Kernel.syscall("groups", "delete_group", [groupName]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            this._save();
            return { success: true };
        }
        return { success: false, error: `group '${groupName}' does not exist.` };
    }

    removeUserFromAllGroups(username) {
        //  Use syscall to remove a user from all groups
        const resultJson = OopisOS_Kernel.syscall("groups", "remove_user_from_all_groups", [username]);
        const result = JSON.parse(resultJson);
        if (result.success && result.data) {
            this._save();
        }
    }
}