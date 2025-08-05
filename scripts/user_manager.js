// gem/scripts/user_manager.js

/**
 * @class UserManager
 * @classdesc Manages all aspects of user accounts, including creation, authentication,
 * password management, and session control (login, logout, su). It is the central
 * authority for user identity and privileges in OopisOS.
 */
class UserManager {
  /**
   * Creates an instance of UserManager.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(dependencies) {
    /** @type {object} */
    this.dependencies = dependencies;
    /** @type {ConfigManager} */
    this.config = dependencies.Config;
    /** @type {FileSystemManager} */
    this.fsManager = dependencies.FileSystemManager;
    /** @type {GroupManager} */
    this.groupManager = dependencies.GroupManager;
    /** @type {StorageManager} */
    this.storageManager = dependencies.StorageManager;
    /** @type {SessionManager|null} */
    this.sessionManager = null;
    /** @type {SudoManager|null} */
    this.sudoManager = null;
    /** @type {CommandExecutor|null} */
    this.commandExecutor = null;
    /** @type {ModalManager|null} */
    this.modalManager = null;
    /**
     * The currently active user object.
     * @type {{name: string}}
     */
    this.currentUser = { name: this.config.USER.DEFAULT_NAME };
  }

  /**
   * Sets dependencies that are initialized after the UserManager.
   * @param {SessionManager} sessionManager - The session manager instance.
   * @param {SudoManager} sudoManager - The sudo manager instance.
   * @param {CommandExecutor} commandExecutor - The command executor instance.
   * @param {ModalManager} modalManager - The modal manager instance.
   */
  setDependencies(sessionManager, sudoManager, commandExecutor, modalManager) {
    this.sessionManager = sessionManager;
    this.sudoManager = sudoManager;
    this.commandExecutor = commandExecutor;
    this.modalManager = modalManager;
  }

  /**
   * Securely hashes a password using PBKDF2 with a random salt.
   * @private
   * @param {string} password - The plaintext password to hash.
   * @returns {Promise<{salt: string, hash: string}>} A promise that resolves to an object containing the salt and hash.
   */
  async _secureHashPassword(password) {
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const rawHash = await window.crypto.subtle.exportKey("raw", key);
    const hashHex = Array.from(new Uint8Array(rawHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return { salt: saltHex, hash: hashHex };
  }

  /**
   * Verifies a password attempt against a stored salt and hash.
   * @private
   * @param {string} passwordAttempt - The password to check.
   * @param {string} saltHex - The stored salt in hexadecimal format.
   * @param {string} storedHashHex - The stored hash in hexadecimal format.
   * @returns {Promise<boolean>} A promise that resolves to true if the password is correct, false otherwise.
   */
  async _verifyPasswordWithSalt(passwordAttempt, saltHex, storedHashHex) {
    const salt = new Uint8Array(
        saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passwordAttempt),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const rawHash = await window.crypto.subtle.exportKey("raw", key);
    const attemptHashHex = Array.from(new Uint8Array(rawHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return (
        attemptHashHex.length === storedHashHex.length &&
        attemptHashHex.split("").every((char, i) => char === storedHashHex[i])
    );
  }

  /**
   * Gets the currently logged-in user.
   * @returns {{name: string}} The current user object.
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Gets the primary group for a specified user.
   * @param {string} username - The name of the user.
   * @returns {string|null} The name of the primary group, or null if not found.
   */
  getPrimaryGroupForUser(username) {
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    return users[username]?.primaryGroup || null;
  }

  /**
   * Checks if a user exists in the system.
   * @param {string} username - The username to check.
   * @returns {Promise<boolean>} True if the user exists, false otherwise.
   */
  async userExists(username) {
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    return users.hasOwnProperty(username);
  }

  /**
   * Registers a new user, hashes their password, and creates their home directory.
   * @param {string} username - The new user's name.
   * @param {string} password - The new user's password.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async register(username, password) {
    const { Utils, ErrorHandler } = this.dependencies;
    const formatValidation = Utils.validateUsernameFormat(username);
    if (!formatValidation.isValid) {
      return ErrorHandler.createError(formatValidation.error);
    }
    if (await this.userExists(username)) {
      return ErrorHandler.createError(`User '${username}' already exists.`);
    }
    let passwordData = null;
    if (password) {
      passwordData = await this._secureHashPassword(password);
      if (!passwordData) {
        return ErrorHandler.createError("Failed to securely process password.");
      }
    }
    this.groupManager.createGroup(username);
    this.groupManager.addUserToGroup(username, username);
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    users[username] = { passwordData, primaryGroup: username };
    await this.fsManager.createUserHomeDirectory(username);

    if (
        this.storageManager.saveItem(
            this.config.STORAGE_KEYS.USER_CREDENTIALS,
            users,
            "User list"
        )
    ) {
      return ErrorHandler.createSuccess(
          `User '${username}' registered. Home directory created at /home/${username}.`,
          { stateModified: true }
      );
    }
    return ErrorHandler.createError("Failed to save new user credentials.");
  }

  /**
   * Verifies a user's password.
   * @param {string} username - The username.
   * @param {string} password - The password to verify.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async verifyPassword(username, password) {
    const { ErrorHandler } = this.dependencies;
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    const userEntry = users[username];
    if (!userEntry) return ErrorHandler.createError("User not found.");
    const { salt, hash } = userEntry?.passwordData || {};
    if (!salt || !hash)
      return ErrorHandler.createError("User does not have a password set.");
    return (await this._verifyPasswordWithSalt(password, salt, hash))
        ? ErrorHandler.createSuccess()
        : ErrorHandler.createError("Incorrect password.");
  }

  /**
   * Executes a command with temporarily elevated (root) privileges.
   * @param {string} commandStr - The full command string to execute.
   * @param {object} options - Execution options to pass to the command executor.
   * @returns {Promise<object>} The result of the command execution.
   */
  async sudoExecute(commandStr, options) {
    const { ErrorHandler } = this.dependencies;
    const originalUser = this.currentUser;
    try {
      this.currentUser = { name: "root" };
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

  /**
   * Changes a user's password. Requires the old password unless the actor is root.
   * @param {string} actorUsername - The user performing the action.
   * @param {string} targetUsername - The user whose password is being changed.
   * @param {string} oldPassword - The target's current password.
   * @param {string} newPassword - The desired new password.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async changePassword(
      actorUsername,
      targetUsername,
      oldPassword,
      newPassword
  ) {
    const { ErrorHandler } = this.dependencies;
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
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
    const newPasswordData = await this._secureHashPassword(newPassword);
    if (!newPasswordData) {
      return ErrorHandler.createError(
          "Failed to securely process new password."
      );
    }
    users[targetUsername].passwordData = newPasswordData;
    if (
        this.storageManager.saveItem(
            this.config.STORAGE_KEYS.USER_CREDENTIALS,
            users,
            "User list"
        )
    ) {
      return ErrorHandler.createSuccess(
          `Password for '${targetUsername}' updated successfully.`
      );
    }
    return ErrorHandler.createError("Failed to save updated password.");
  }

  /**
   * Handles the generic authentication flow for login and su.
   * @private
   * @param {string} username - The username to authenticate.
   * @param {string|null} providedPassword - The password provided in the command, if any.
   * @param {Function} successCallback - The function to call on successful authentication.
   * @param {string} failureMessage - The error message to show on failure.
   * @param {object} options - Execution options for the modal manager.
   * @returns {Promise<object>} The result of the authentication flow.
   */
  async _handleAuthFlow(
      username,
      providedPassword,
      successCallback,
      failureMessage,
      options
  ) {
    const { ErrorHandler } = this.dependencies;
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    const userEntry = users[username];

    if (!userEntry && username !== this.config.USER.DEFAULT_NAME && username !== "root") {
      return ErrorHandler.createError("Invalid username.");
    }

    const { salt, hash } = userEntry?.passwordData || {};

    if (salt && hash) {
      if (providedPassword !== null) {
        if (await this._verifyPasswordWithSalt(providedPassword, salt, hash)) {
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
              if (await this._verifyPasswordWithSalt(passwordFromPrompt, salt, hash)) {
                resolve(await successCallback(username));
              } else {
                this.dependencies.AuditManager.log(username, 'auth_failure', `Failed login attempt for user '${username}'.`);
                resolve(ErrorHandler.createError(failureMessage));
              }
            },
            onCancel: () =>
                resolve(
                    ErrorHandler.createSuccess({
                      output: this.config.MESSAGES.OPERATION_CANCELLED,
                    })
                ),
            options,
          });
        });
      }
    } else {
      if (providedPassword !== null) {
        return ErrorHandler.createError(
            "This account does not require a password."
        );
      }
      return await successCallback(username);
    }
  }

  /**
   * Logs in a user, clearing the current session stack.
   * @param {string} username - The username to log in as.
   * @param {string|null} providedPassword - The password, if provided.
   * @param {object} [options={}] - Execution options.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async login(username, providedPassword, options = {}) {
    const { ErrorHandler } = this.dependencies;
    const currentUserName = this.getCurrentUser().name;
    if (username === currentUserName) {
      return ErrorHandler.createSuccess({
        message: `${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`,
        noAction: true,
      });
    }
    if (this.sessionManager.getStack().includes(username)) {
      return ErrorHandler.createError(
          `${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${this.config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`
      );
    }
    return this._handleAuthFlow(
        username,
        providedPassword,
        this._performLogin.bind(this),
        "Login failed.",
        options
    );
  }

  /**
   * Performs the internal state changes for a successful login.
   * @private
   * @param {string} username - The username that has successfully logged in.
   * @returns {object} An ErrorHandler success object.
   */
  _performLogin(username) {
    const { ErrorHandler } = this.dependencies;
    if (this.currentUser.name !== this.config.USER.DEFAULT_NAME) {
      this.sessionManager.saveAutomaticState(this.currentUser.name);
      this.sudoManager.clearUserTimestamp(this.currentUser.name);
    }
    this.sessionManager.clearUserStack(username);
    this.currentUser = { name: username };
    this.sessionManager.loadAutomaticState(username);
    const homePath = `/home/${username}`;
    this.fsManager.setCurrentPath(
        this.fsManager.getNodeByPath(homePath)
            ? homePath
            : this.config.FILESYSTEM.ROOT_PATH
    );
    this.dependencies.AuditManager.log(username, 'login_success', `User logged in successfully.`);
    return ErrorHandler.createSuccess({
      message: `Logged in as ${username}.`,
      isLogin: true,
    });
  }

  /**
   * Switches to another user, stacking the new session on top of the old one.
   * @param {string} username - The username to switch to.
   * @param {string|null} providedPassword - The password, if provided.
   * @param {object} [options={}] - Execution options.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async su(username, providedPassword, options = {}) {
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

  /**
   * Performs the internal state changes for a successful 'su'.
   * @private
   * @param {string} username - The username to switch to.
   * @returns {object} An ErrorHandler success object.
   */
  _performSu(username) {
    const { ErrorHandler } = this.dependencies;
    this.sessionManager.saveAutomaticState(this.currentUser.name);
    this.sessionManager.pushUserToStack(username);
    this.currentUser = { name: username };
    this.sessionManager.loadAutomaticState(username);
    const homePath = `/home/${username}`;
    this.fsManager.setCurrentPath(
        this.fsManager.getNodeByPath(homePath)
            ? homePath
            : this.config.FILESYSTEM.ROOT_PATH
    );
    this.dependencies.AuditManager.log(this.getCurrentUser().name, 'su_success', `Switched to user: ${username}.`);
    return ErrorHandler.createSuccess({
      message: `Switched to user: ${username}.`,
    });
  }

  /**
   * Logs out of the current session, returning to the previous user in the stack.
   * @returns {Promise<object>} An ErrorHandler result object.
   */
  async logout() {
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
    this.fsManager.setCurrentPath(
        this.fsManager.getNodeByPath(homePath)
            ? homePath
            : this.config.FILESYSTEM.ROOT_PATH
    );
    return ErrorHandler.createSuccess({
      message: `Logged out from ${oldUser}. Now logged in as ${newUsername}.`,
      isLogout: true,
      newUser: newUsername,
    });
  }

  /**
   * Ensures the default 'root' and 'Guest' users exist on first run, creating
   * a one-time random password for the root user.
   * @returns {Promise<void>}
   */
  async initializeDefaultUsers() {
    const { OutputManager, Config } = this.dependencies;
    const users = this.storageManager.loadItem(
        this.config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    let changesMade = false;
    if (!users["root"] || !users["root"].passwordData) {
      const randomPassword = Math.random().toString(36).slice(-8);
      users["root"] = {
        passwordData: await this._secureHashPassword(randomPassword),
        primaryGroup: "root",
      };
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
    if (!users[this.config.USER.DEFAULT_NAME]) {
      users[this.config.USER.DEFAULT_NAME] = {
        passwordData: null,
        primaryGroup: this.config.USER.DEFAULT_NAME,
      };
      changesMade = true;
    }
    if (changesMade) {
      this.storageManager.saveItem(
          this.config.STORAGE_KEYS.USER_CREDENTIALS,
          users,
          "User list"
      );
    }
  }
}