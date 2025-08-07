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

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.groupManager;
        }
        throw new Error("Python kernel for GroupManager is not available.");
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    initialize() {
        const { StorageManager, Config } = this.dependencies;
        // The JS GroupManager no longer holds state, but we need to sync Python state with localStorage on boot.
        const groupsFromStorage = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            null
        );

        if (groupsFromStorage) {
            this._getManager().load_groups(groupsFromStorage);
        } else {
            this._getManager().initialize_defaults();
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

    getAllGroups() {
        try {
            const pyProxy = this._getManager().get_all_groups();
            const jsObject = pyProxy.toJs({ dict_converter: Object.fromEntries });
            pyProxy.destroy();
            return jsObject;
        } catch (e) {
            console.error(e);
            return {};
        }
    }

    groupExists(groupName) {
        return this._getManager().group_exists(groupName);
    }

    createGroup(groupName) {
        const result = this._getManager().create_group(groupName);
        if (result) {
            this._save();
        }
        return result;
    }

    addUserToGroup(username, groupName) {
        const result = this._getManager().add_user_to_group(username, groupName);
        if (result) {
            this._save();
        }
        return result;
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
        const result = this._getManager().delete_group(groupName);
        if (result) {
            this._save();
            return { success: true };
        }
        return { success: false, error: `group '${groupName}' does not exist.` };
    }

    removeUserFromAllGroups(username) {
        const result = this._getManager().remove_user_from_all_groups(username);
        if (result) {
            this._save();
        }
    }
}