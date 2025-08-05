// scripts/sudo_manager.js

/**
 * @class SudoManager
 * @classdesc Manages sudo privileges, parsing the /etc/sudoers file to determine
 * which users can run which commands as root. It also handles timestamp-based
 * authentication to avoid repeated password prompts.
 */
class SudoManager {
  /**
   * Creates an instance of SudoManager.
   */
  constructor() {
    /**
     * The parsed configuration from the /etc/sudoers file.
     * @type {object|null}
     */
    this.sudoersConfig = null;
    /**
     * A map of usernames to the timestamp of their last successful sudo authentication.
     * @type {object.<string, number>}
     */
    this.userSudoTimestamps = {};
    /**
     * A reference to the FileSystemManager instance.
     * @type {FileSystemManager|null}
     */
    this.fsManager = null;
    /**
     * A reference to the GroupManager instance.
     * @type {GroupManager|null}
     */
    this.groupManager = null;
    /**
     * A reference to the global ConfigManager instance.
     * @type {ConfigManager|null}
     */
    this.config = null;
  }

  /**
   * Sets the dependencies for the SudoManager.
   * @param {FileSystemManager} fsManager - The file system manager instance.
   * @param {GroupManager} groupManager - The group manager instance.
   * @param {ConfigManager} config - The global configuration manager instance.
   */
  setDependencies(fsManager, groupManager, config) {
    this.fsManager = fsManager;
    this.groupManager = groupManager;
    this.config = config;
  }

  /**
   * Parses the /etc/sudoers file and caches the configuration.
   * @private
   */
  _parseSudoers() {
    const sudoersNode = this.fsManager.getNodeByPath(
        this.config.SUDO.SUDOERS_PATH
    );
    if (!sudoersNode || sudoersNode.type !== "file") {
      this.sudoersConfig = {
        users: {},
        groups: {},
        timeout: this.config.SUDO.DEFAULT_TIMEOUT,
      };
      return;
    }

    const content = sudoersNode.content || "";
    const lines = content.split("\n");
    const config = {
      users: {},
      groups: {},
      timeout: this.config.SUDO.DEFAULT_TIMEOUT,
    };

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("#") || line === "") return;

      if (line.toLowerCase().startsWith("defaults timestamp_timeout=")) {
        const timeoutValue = parseInt(line.split("=")[1], 10);
        if (!isNaN(timeoutValue) && timeoutValue >= 0) {
          config.timeout = timeoutValue;
        }
        return;
      }

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        console.warn(
            `SudoManager: Malformed line in /etc/sudoers: "${line}". Ignoring.`
        );
        return;
      }

      const entity = parts[0];
      const permissions = parts.slice(1).join(" ");

      if (entity.startsWith("%")) {
        config.groups[entity.substring(1)] = permissions;
      } else {
        config.users[entity] = permissions;
      }
    });
    this.sudoersConfig = config;
  }

  /**
   * Retrieves the sudoers configuration, parsing it if not already cached.
   * @private
   * @returns {object} The parsed sudoers configuration.
   */
  _getSudoersConfig() {
    if (!this.sudoersConfig) {
      this._parseSudoers();
    }
    return this.sudoersConfig;
  }

  /**
   * Invalidates the cached sudoers configuration, forcing a re-parse on the next check.
   */
  invalidateSudoersCache() {
    this.sudoersConfig = null;
  }

  /**
   * Checks if a user's sudo timestamp is still valid.
   * @param {string} username - The name of the user to check.
   * @returns {boolean} True if the timestamp is valid, false otherwise.
   */
  isUserTimestampValid(username) {
    const timestamp = this.userSudoTimestamps[username];
    if (!timestamp) return false;

    const config = this._getSudoersConfig();
    const timeoutMinutes = config.timeout || 0;
    if (timeoutMinutes <= 0) return false;

    const now = new Date().getTime();
    const elapsedMinutes = (now - timestamp) / (1000 * 60);

    return elapsedMinutes < timeoutMinutes;
  }

  /**
   * Updates a user's sudo timestamp to the current time.
   * @param {string} username - The name of the user to update.
   */
  updateUserTimestamp(username) {
    this.userSudoTimestamps[username] = new Date().getTime();
  }

  /**
   * Clears a user's sudo timestamp, forcing a password prompt on the next sudo attempt.
   * @param {string} username - The name of the user whose timestamp to clear.
   */
  clearUserTimestamp(username) {
    if (this.userSudoTimestamps[username]) {
      delete this.userSudoTimestamps[username];
    }
  }

  /**
   * Determines if a user has permission to run a specific command via sudo.
   * @param {string} username - The name of the user.
   * @param {string} commandToRun - The command the user is attempting to run.
   * @returns {boolean} True if the user is permitted, false otherwise.
   */
  canUserRunCommand(username, commandToRun) {
    if (username === "root") return true;

    const config = this._getSudoersConfig();
    let userPermissions = config.users[username];

    if (!userPermissions) {
      const userGroups = this.groupManager.getGroupsForUser(username);
      for (const group of userGroups) {
        if (config.groups[group]) {
          userPermissions = config.groups[group];
          break;
        }
      }
    }

    if (!userPermissions) return false;
    if (userPermissions.trim() === "ALL") return true;

    const allowedCommands = userPermissions.split(",").map((cmd) => cmd.trim());

    for (const allowed of allowedCommands) {
      if (allowed === commandToRun || allowed.endsWith("/" + commandToRun)) {
        return true;
      }
    }

    return false;
  }
}