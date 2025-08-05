// scripts/group_manager.js

/**
 * Manages user groups and their memberships. This is a core component of the
 * OopisOS permission model, ensuring that users can be organized and
 * permissions can be applied to collections of users.
 * @class GroupManager
 */
class GroupManager {
  /**
   * @constructor
   */
  constructor() {
    /**
     * An object containing all defined groups, with members.
     * @type {object.<string, {members: string[]}>}
     */
    this.groups = {};
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
  }

  /**
   * Sets the dependency injection container.
   * @param {object} dependencies - The dependencies to be injected.
   */
  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Initializes the group manager by loading existing groups from storage
   * or creating a default set of groups if none exist.
   */
  initialize() {
    const { StorageManager, Config } = this.dependencies;
    this.groups = StorageManager.loadItem(
        Config.STORAGE_KEYS.USER_GROUPS,
        "User Groups",
        {}
    );
    if (!this.groups["root"]) {
      this.createGroup("root");
      this.addUserToGroup("root", "root");
    }
    if (!this.groups["Guest"]) {
      this.createGroup("Guest");
      this.addUserToGroup("Guest", "Guest");
    }
    if (!this.groups["userDiag"]) {
      this.createGroup("userDiag");
      this.addUserToGroup("userDiag", "userDiag");
    }
    if (!this.groups["towncrier"]) {
      this.createGroup("towncrier");
    }
    console.log("GroupManager initialized.");
  }

  /**
   * Saves the current state of the groups to persistent storage.
   * @private
   */
  _save() {
    const { StorageManager, Config } = this.dependencies;
    StorageManager.saveItem(
        Config.STORAGE_KEYS.USER_GROUPS,
        this.groups,
        "User Groups"
    );
  }

  /**
   * Checks if a group with the given name exists.
   * @param {string} groupName - The name of the group.
   * @returns {boolean} True if the group exists, false otherwise.
   */
  groupExists(groupName) {
    return !!this.groups[groupName];
  }

  /**
   * Creates a new, empty group.
   * @param {string} groupName - The name of the group to create.
   * @returns {boolean} True if the group was created, false if it already existed.
   */
  createGroup(groupName) {
    if (this.groupExists(groupName)) {
      return false;
    }
    this.groups[groupName] = { members: [] };
    this._save();
    return true;
  }

  /**
   * Adds a user to an existing group.
   * @param {string} username - The name of the user to add.
   * @param {string} groupName - The name of the group.
   * @returns {boolean} True if the user was added, false otherwise (e.g., group doesn't exist or user is already a member).
   */
  addUserToGroup(username, groupName) {
    if (
        this.groupExists(groupName) &&
        !this.groups[groupName].members.includes(username)
    ) {
      this.groups[groupName].members.push(username);
      this._save();
      return true;
    }
    return false;
  }

  /**
   * Gets a list of all groups a user is a member of, including their primary group.
   * @param {string} username - The name of the user.
   * @returns {string[]} An array of group names.
   */
  getGroupsForUser(username) {
    const { StorageManager, Config } = this.dependencies;
    const userGroups = [];
    const users = StorageManager.loadItem(
        Config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    const primaryGroup = users[username]?.primaryGroup;

    if (primaryGroup) {
      userGroups.push(primaryGroup);
    }

    for (const groupName in this.groups) {
      if (
          this.groups[groupName].members &&
          this.groups[groupName].members.includes(username)
      ) {
        if (!userGroups.includes(groupName)) {
          userGroups.push(groupName);
        }
      }
    }
    return userGroups;
  }

  /**
   * Deletes an existing group. Fails if the group is a primary group for any user.
   * @param {string} groupName - The name of the group to delete.
   * @returns {object} A success or error object.
   */
  deleteGroup(groupName) {
    const { StorageManager } = this.dependencies;
    if (!this.groupExists(groupName)) {
      return { success: false, error: `group '${groupName}' does not exist.` };
    }

    const users = StorageManager.loadItem(
        this.dependencies.Config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    for (const username in users) {
      if (users[username].primaryGroup === groupName) {
        return {
          success: false,
          error: `cannot remove group '${groupName}': it is the primary group of user '${username}'.`,
        };
      }
    }

    delete this.groups[groupName];
    this._save();
    return { success: true };
  }

  /**
   * Removes a user from all groups.
   * @param {string} username - The name of the user.
   */
  removeUserFromAllGroups(username) {
    let changed = false;
    for (const groupName in this.groups) {
      const index = this.groups[groupName].members.indexOf(username);
      if (index > -1) {
        this.groups[groupName].members.splice(index, 1);
        changed = true;
      }
    }
    if (changed) {
      this._save();
    }
  }
}