// gem/scripts/sudo_manager.js

/**
 * @class SudoManager
 * @classdesc An API client for the OopisOS Python Sudo Manager kernel.
 * All core logic for parsing /etc/sudoers and checking permissions is now handled by `core/sudo.py`.
 * This JS class manages sudo session timestamps.
 */
class SudoManager {
    constructor() {
        this.userSudoTimestamps = {};
        this.dependencies = {};
        this.config = null;
        this.groupManager = null;
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.sudoManager;
        }
        throw new Error("Python kernel for SudoManager is not available.");
    }

    setDependencies(fsManager, groupManager, config) {
        this.dependencies = { fsManager, groupManager, config };
        this.config = config;
        this.groupManager = groupManager;
    }

    isUserTimestampValid(username) {
        const timestamp = this.userSudoTimestamps[username];
        if (!timestamp) return false;

        // For now, we'll keep timeout logic in JS side, but it could be moved to Python.
        // We'll read the timeout from the JS config for simplicity.
        const timeoutMinutes = this.config.SUDO.DEFAULT_TIMEOUT || 15;
        if (timeoutMinutes <= 0) return false;

        const now = new Date().getTime();
        const elapsedMinutes = (now - timestamp) / (1000 * 60);

        return elapsedMinutes < timeoutMinutes;
    }

    updateUserTimestamp(username) {
        this.userSudoTimestamps[username] = new Date().getTime();
    }

    clearUserTimestamp(username) {
        if (this.userSudoTimestamps[username]) {
            delete this.userSudoTimestamps[username];
        }
    }

    canUserRunCommand(username, commandToRun) {
        try {
            const userGroups = this.groupManager.getGroupsForUser(username);
            // Delegate the actual check to the Python kernel
            return this._getManager().can_user_run_command(username, userGroups, commandToRun);
        } catch (e) {
            console.error("Failed to call Python SudoManager:", e);
            return false;
        }
    }

    // The parseSudoers and invalidateSudoersCache methods are now obsolete in JS
    // as this is handled entirely within the Python module.
}