// scripts/session_manager.js

/**
 * @class EnvironmentManager
 * @classdesc Manages shell environment variables, including a stack for nested sessions like 'su'.
 */
class EnvironmentManager {
  /**
   * Initializes the environment manager with a base environment stack.
   */
  constructor() {
    /**
     * A stack of environment objects to support nested sessions.
     * @type {Array<Object<string, string>>}
     */
    this.envStack = [{}];
    /**
     * Reference to the UserManager instance.
     * @type {UserManager|null}
     */
    this.userManager = null;
    /**
     * Reference to the FileSystemManager instance.
     * @type {FileSystemManager|null}
     */
    this.fsManager = null;
    /**
     * Reference to the Config instance.
     * @type {ConfigManager|null}
     */
    this.config = null; // Add config dependency
  }

  /**
   * Sets the dependencies for the EnvironmentManager.
   * @param {UserManager} userManager - The user manager instance.
   * @param {FileSystemManager} fsManager - The file system manager instance.
   * @param {ConfigManager} config - The configuration manager instance.
   */
  setDependencies(userManager, fsManager, config) {
    this.userManager = userManager;
    this.fsManager = fsManager;
    this.config = config;
  }

  /**
   * Gets the currently active environment from the top of the stack.
   * @private
   * @returns {Object<string, string>} The active environment object.
   */
  _getActiveEnv() {
    return this.envStack[this.envStack.length - 1];
  }

  /**
   * Pushes a new, duplicated environment onto the stack for a new session.
   */
  push() {
    this.envStack.push(JSON.parse(JSON.stringify(this._getActiveEnv())));
  }

  /**
   * Pops the current environment from the stack, returning to the previous session's environment.
   */
  pop() {
    if (this.envStack.length > 1) {
      this.envStack.pop();
    } else {
      console.error(
          "EnvironmentManager: Attempted to pop the base environment stack."
      );
    }
  }

  /**
   * Initializes the base environment with default variables like USER, HOME, HOST, and PATH.
   */
  initialize() {
    const baseEnv = {};
    const currentUser = this.userManager.getCurrentUser().name;
    baseEnv["USER"] = currentUser;
    baseEnv["HOME"] = `/home/${currentUser}`;
    baseEnv["HOST"] = this.config.OS.DEFAULT_HOST_NAME;
    baseEnv["PATH"] = "/bin:/usr/bin";
    this.envStack = [baseEnv];
  }

  /**
   * Gets the value of a specific environment variable.
   * @param {string} varName - The name of the variable to retrieve.
   * @returns {string} The value of the variable, or an empty string if not found.
   */
  get(varName) {
    return this._getActiveEnv()[varName] || "";
  }

  /**
   * Sets the value of an environment variable.
   * @param {string} varName - The name of the variable to set.
   * @param {string} value - The value to assign to the variable.
   * @returns {{success: boolean, error?: string}} A result object.
   */
  set(varName, value) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
      return {
        success: false,
        error: `Invalid variable name: '${varName}'. Must start with a letter or underscore, followed by letters, numbers, or underscores.`,
      };
    }
    this._getActiveEnv()[varName] = value;
    return { success: true };
  }

  /**
   * Deletes an environment variable.
   * @param {string} varName - The name of the variable to unset.
   */
  unset(varName) {
    delete this._getActiveEnv()[varName];
  }

  /**
   * Gets a copy of all current environment variables.
   * @returns {Object<string, string>} A copy of the active environment.
   */
  getAll() {
    return { ...this._getActiveEnv() };
  }

  /**
   * Loads a new set of variables into the current environment, replacing existing ones.
   * @param {Object<string, string>} vars - The variables to load.
   */
  load(vars) {
    this.envStack[this.envStack.length - 1] = { ...(vars || {}) };
  }

  /**
   * Clears all variables from the current environment.
   */
  clear() {
    this.envStack[this.envStack.length - 1] = {};
  }
}

/**
 * @class HistoryManager
 * @classdesc Manages the command history for the terminal session.
 */
class HistoryManager {
  /**
   * Initializes the HistoryManager.
   */
  constructor() {
    /**
     * An array storing the command history.
     * @type {string[]}
     */
    this.commandHistory = [];
    /**
     * The current position in the history for up/down arrow navigation.
     * @type {number}
     */
    this.historyIndex = 0;
    /**
     * A container for dependency injection.
     * @type {object}
     */
    this.dependencies = {};
    /**
     * Reference to the Config instance.
     * @type {ConfigManager|null}
     */
    this.config = null;
  }

  /**
   * Sets the dependencies for the HistoryManager.
   * @param {object} injectedDependencies - The dependency container.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
    this.config = injectedDependencies.Config;
  }

  /**
   * Adds a command to the history.
   * @param {string} command - The command string to add.
   */
  add(command) {
    const trimmedCommand = command.trim();
    if (
        trimmedCommand &&
        (this.commandHistory.length === 0 ||
            this.commandHistory[this.commandHistory.length - 1] !== trimmedCommand)
    ) {
      this.commandHistory.push(trimmedCommand);
      if (this.commandHistory.length > this.config.TERMINAL.MAX_HISTORY_SIZE)
        this.commandHistory.shift();
    }
    this.historyIndex = this.commandHistory.length;
  }

  /**
   * Gets the previous command from history for arrow-up navigation.
   * @returns {string|null} The previous command, or null if at the beginning.
   */
  getPrevious() {
    if (this.commandHistory.length > 0 && this.historyIndex > 0) {
      this.historyIndex--;
      return this.commandHistory[this.historyIndex];
    }
    return null;
  }

  /**
   * Gets the next command from history for arrow-down navigation.
   * @returns {string|null} The next command, or an empty string if at the end.
   */
  getNext() {
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      return this.commandHistory[this.historyIndex];
    } else if (this.historyIndex >= this.commandHistory.length - 1) {
      this.historyIndex = this.commandHistory.length;
      return "";
    }
    return null;
  }

  /**
   * Resets the history navigation index to the end of the history list.
   */
  resetIndex() {
    this.historyIndex = this.commandHistory.length;
  }

  /**
   * Returns a copy of the full command history.
   * @returns {string[]} An array of all commands in history.
   */
  getFullHistory() {
    return [...this.commandHistory];
  }

  /**
   * Clears the command history.
   */
  clearHistory() {
    this.commandHistory = [];
    this.historyIndex = 0;
  }

  /**
   * Sets the command history to a new array of commands.
   * @param {string[]} newHistory - The new history array.
   */
  setHistory(newHistory) {
    this.commandHistory = Array.isArray(newHistory) ? [...newHistory] : [];
    if (this.commandHistory.length > this.config.TERMINAL.MAX_HISTORY_SIZE)
      this.commandHistory = this.commandHistory.slice(
          this.commandHistory.length - this.config.TERMINAL.MAX_HISTORY_SIZE
      );
    this.historyIndex = this.commandHistory.length;
  }
}

/**
 * @class AliasManager
 * @classdesc Manages command aliases, allowing users to create shortcuts for longer commands.
 */
class AliasManager {
  /**
   * Initializes the AliasManager.
   */
  constructor() {
    /**
     * An object storing the alias definitions.
     * @type {Object<string, string>}
     */
    this.aliases = {};
    /**
     * A container for dependency injection.
     * @type {object}
     */
    this.dependencies = {};
    /**
     * Reference to the Config instance.
     * @type {ConfigManager|null}
     */
    this.config = null;
  }

  /**
   * Sets the dependencies for the AliasManager.
   * @param {object} injectedDependencies - The dependency container.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
    this.config = injectedDependencies.Config;
  }

  /**
   * Saves the current aliases to persistent storage.
   * @private
   */
  _save() {
    const { StorageManager } = this.dependencies;
    StorageManager.saveItem(
        this.config.STORAGE_KEYS.ALIAS_DEFINITIONS,
        this.aliases,
        "Aliases"
    );
  }

  /**
   * Initializes the AliasManager, loading aliases from storage or creating defaults.
   */
  initialize() {
    const { StorageManager } = this.dependencies;
    this.aliases = StorageManager.loadItem(
        this.config.STORAGE_KEYS.ALIAS_DEFINITIONS,
        "Aliases",
        {}
    );

    // Set up default aliases on first boot
    if (Object.keys(this.aliases).length === 0) {
      const defaultAliases = {
        'll': 'ls -la',
        'la': 'ls -a',
        '..': 'cd ..',
        '...': 'cd ../..',
        'h': 'history',
        'c': 'clear',
        'q': 'exit',
        'e': 'edit',
        'ex': 'explore'
      };

      Object.entries(defaultAliases).forEach(([name, value]) => {
        this.aliases[name] = value;
      });
      this._save();
    }
  }

  /**
   * Sets or updates an alias.
   * @param {string} name - The name of the alias.
   * @param {string} value - The command string the alias expands to.
   * @returns {boolean} True on success, false on failure.
   */
  setAlias(name, value) {
    if (!name || typeof value !== "string") return false;
    this.aliases[name] = value;
    this._save();
    return true;
  }

  /**
   * Removes an alias.
   * @param {string} name - The name of the alias to remove.
   * @returns {boolean} True if the alias was removed, false if it didn't exist.
   */
  removeAlias(name) {
    if (!this.aliases[name]) return false;
    delete this.aliases[name];
    this._save();
    return true;
  }

  /**
   * Gets the value of a specific alias.
   * @param {string} name - The name of the alias.
   * @returns {string|null} The command string of the alias, or null if not found.
   */
  getAlias(name) {
    return this.aliases[name] || null;
  }

  /**
   * Gets a copy of all defined aliases.
   * @returns {Object<string, string>} An object containing all aliases.
   */
  getAllAliases() {
    return { ...this.aliases };
  }

  /**
   * Resolves a command string, expanding any aliases it may start with.
   * @param {string} commandString - The command string to resolve.
   * @returns {{newCommand: string, error?: string}} An object with the resolved command or an error.
   */
  resolveAlias(commandString) {
    const parts = commandString.split(/\s+/);
    let commandName = parts[0];
    const remainingArgs = parts.slice(1).join(" ");
    const MAX_RECURSION = 10;
    let count = 0;
    while (this.aliases[commandName] && count < MAX_RECURSION) {
      const aliasValue = this.aliases[commandName];
      const aliasParts = aliasValue.split(/\s+/);
      commandName = aliasParts[0];
      const aliasArgs = aliasParts.slice(1).join(" ");
      commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
      count++;
    }
    if (count === MAX_RECURSION) {
      return {
        error: `Alias loop detected for '${parts[0]}'`,
      };
    }
    return {
      newCommand: commandString,
    };
  }
}

/**
 * @class SessionManager
 * @classdesc Manages user sessions, including login, logout, su, and state persistence.
 */
class SessionManager {
  /**
   * Initializes the SessionManager.
   */
  constructor() {
    /**
     * A stack of usernames to manage 'su' sessions.
     * @type {string[]}
     */
    this.userSessionStack = [];
    /**
     * A cache of key DOM elements.
     * @type {object}
     */
    this.elements = {};
    /**
     * A container for dependency injection.
     * @type {object}
     */
    this.dependencies = {};
    this.config = null;
    this.fsManager = null;
    this.userManager = null;
    this.environmentManager = null;
    this.outputManager = null;
    this.terminalUI = null;
    this.storageManager = null;
  }

  /**
   * Sets the dependencies for the SessionManager.
   * @param {object} dependencies - The dependency container.
   */
  setDependencies(dependencies) {
    this.dependencies = dependencies;
    this.config = dependencies.Config;
    this.fsManager = dependencies.FileSystemManager;
    this.userManager = dependencies.UserManager;
    this.environmentManager = dependencies.EnvironmentManager;
    this.elements = dependencies.domElements; // Get domElements from dependencies
    this.outputManager = dependencies.OutputManager;
    this.terminalUI = dependencies.TerminalUI;
    this.storageManager = dependencies.StorageManager;
  }

  /**
   * Initializes the user session stack with the default user.
   */
  initializeStack() {
    this.userSessionStack = [this.config.USER.DEFAULT_NAME];
  }

  /**
   * Gets the current user session stack.
   * @returns {string[]} The session stack.
   */
  getStack() {
    return this.userSessionStack;
  }

  /**
   * Pushes a new user onto the session stack (for 'su').
   * @param {string} username - The username to push.
   */
  pushUserToStack(username) {
    this.userSessionStack.push(username);
  }

  /**
   * Pops a user from the session stack (for 'logout').
   * @returns {string|null} The popped username, or null if it's the base session.
   */
  popUserFromStack() {
    if (this.userSessionStack.length > 1) {
      return this.userSessionStack.pop();
    }
    return null;
  }

  /**
   * Gets the current user from the top of the session stack.
   * @returns {string} The current username.
   */
  getCurrentUserFromStack() {
    return this.userSessionStack.length > 0
        ? this.userSessionStack[this.userSessionStack.length - 1]
        : this.config.USER.DEFAULT_NAME;
  }

  /**
   * Clears the session stack and starts a new one with the given user (for 'login').
   * @param {string} username - The username for the new session.
   */
  clearUserStack(username) {
    this.userSessionStack = [username];
  }

  /**
   * Gets the storage key for a user's automatic session state.
   * @private
   * @param {string} user - The username.
   * @returns {string} The storage key.
   */
  _getAutomaticSessionStateKey(user) {
    return `${this.config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`;
  }

  /**
   * Gets the storage key for a user's manually saved state.
   * @private
   * @param {string|object} user - The username or user object.
   * @returns {string} The storage key.
   */
  _getManualUserTerminalStateKey(user) {
    const userName =
        typeof user === "object" && user !== null && user.name
            ? user.name
            : String(user);
    return `${this.config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`;
  }

  /**
   * Saves the current terminal state (output, input, history, env vars) for a user.
   * @param {string} username - The username for which to save the state.
   */
  saveAutomaticState(username) {
    if (!username) {
      console.warn(
          "saveAutomaticState: No username provided. State not saved."
      );
      return;
    }
    const currentInput = this.terminalUI.getCurrentInputValue();
    const autoState = {
      currentPath: this.fsManager.getCurrentPath(),
      outputHTML: this.elements.outputDiv
          ? this.elements.outputDiv.innerHTML
          : "",
      currentInput: currentInput,
      commandHistory: this.dependencies.HistoryManager.getFullHistory(),
      environmentVariables: this.environmentManager.getAll(),
    };
    this.storageManager.saveItem(
        this._getAutomaticSessionStateKey(username),
        autoState,
        `Auto session for ${username}`
    );
  }

  /**
   * Loads a user's automatic session state into the terminal.
   * @param {string} username - The username whose state to load.
   * @returns {boolean} True if a state was loaded, false otherwise.
   */
  loadAutomaticState(username) {
    if (!username) {
      console.warn(
          "loadAutomaticState: No username provided. Cannot load state."
      );
      if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
      this.terminalUI.setCurrentInputValue("");
      this.fsManager.setCurrentPath(this.config.FILESYSTEM.ROOT_PATH);
      this.dependencies.HistoryManager.clearHistory();
      void this.outputManager.appendToOutput(
          `${this.config.MESSAGES.WELCOME_PREFIX} ${this.config.USER.DEFAULT_NAME}${this.config.MESSAGES.WELCOME_SUFFIX}`
      );
      this.terminalUI.updatePrompt();
      if (this.elements.outputDiv)
        this.elements.outputDiv.scrollTop =
            this.elements.outputDiv.scrollHeight;
      return false;
    }
    const autoState = this.storageManager.loadItem(
        this._getAutomaticSessionStateKey(username),
        `Auto session for ${username}`
    );
    if (autoState) {
      this.fsManager.setCurrentPath(
          autoState.currentPath || this.config.FILESYSTEM.ROOT_PATH
      );
      if (this.elements.outputDiv) {
        if (autoState.hasOwnProperty("outputHTML")) {
          this.elements.outputDiv.innerHTML = autoState.outputHTML || "";
        } else {
          this.elements.outputDiv.innerHTML = "";
          void this.outputManager.appendToOutput(
              `${this.config.MESSAGES.WELCOME_PREFIX} ${username}${this.config.MESSAGES.WELCOME_SUFFIX}`
          );
        }
      }
      this.terminalUI.setCurrentInputValue(autoState.currentInput || "");
      this.dependencies.HistoryManager.setHistory(autoState.commandHistory || []);
      this.environmentManager.load(autoState.environmentVariables);
    } else {
      if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
      this.terminalUI.setCurrentInputValue("");
      const homePath = `/home/${username}`;
      if (this.fsManager.getNodeByPath(homePath)) {
        this.fsManager.setCurrentPath(homePath);
      } else {
        this.fsManager.setCurrentPath(this.config.FILESYSTEM.ROOT_PATH);
      }
      this.dependencies.HistoryManager.clearHistory();

      const newEnv = {};
      newEnv["USER"] = username;
      newEnv["HOME"] = `/home/${username}`;
      newEnv["HOST"] = this.config.OS.DEFAULT_HOST_NAME;
      newEnv["PATH"] = "/bin:/usr/bin";
      this.environmentManager.load(newEnv);

      void this.outputManager.appendToOutput(
          `${this.config.MESSAGES.WELCOME_PREFIX} ${username}${this.config.MESSAGES.WELCOME_SUFFIX}`
      );
    }
    this.terminalUI.updatePrompt();
    if (this.elements.outputDiv)
      this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
    return !!autoState;
  }

  /**
   * Manually saves the entire system state, including the filesystem.
   * @returns {Promise<object>} A promise that resolves with a success or error object.
   */
  async saveManualState() {
    const currentUser = this.userManager.getCurrentUser();
    const currentInput = this.terminalUI.getCurrentInputValue();
    const manualStateData = {
      user: currentUser.name,
      osVersion: this.config.OS.VERSION,
      timestamp: new Date().toISOString(),
      currentPath: this.fsManager.getCurrentPath(),
      outputHTML: this.elements.outputDiv
          ? this.elements.outputDiv.innerHTML
          : "",
      currentInput: currentInput,
      fsDataSnapshot: this.dependencies.Utils.deepCopyNode(this.fsManager.getFsData()),
      commandHistory: this.dependencies.HistoryManager.getFullHistory(),
    };
    if (
        this.storageManager.saveItem(
            this._getManualUserTerminalStateKey(currentUser),
            manualStateData,
            `Manual save for ${currentUser.name}`
        )
    )
      return {
        success: true,
        data: {
          message: `${this.config.MESSAGES.SESSION_SAVED_FOR_PREFIX}${currentUser.name}.`,
        },
      };
    else
      return {
        success: false,
        error: "Failed to save session manually.",
      };
  }

  /**
   * Loads a manually saved system state, prompting the user for confirmation.
   * @param {object} [options={}] - Command execution options.
   * @returns {Promise<object>} A promise that resolves with a result object.
   */
  async loadManualState(options = {}) {
    const currentUser = this.userManager.getCurrentUser();
    const manualStateData = this.storageManager.loadItem(
        this._getManualUserTerminalStateKey(currentUser),
        `Manual save for ${currentUser.name}`
    );

    if (!manualStateData) {
      return {
        success: false,
        data: {
          message: `${this.config.MESSAGES.NO_MANUAL_SAVE_FOUND_PREFIX}${currentUser.name}.`,
        },
      };
    }

    if (manualStateData.user && manualStateData.user !== currentUser.name) {
      await this.outputManager.appendToOutput(
          `Warning: Saved state is for user '${manualStateData.user}'. Current user is '${currentUser.name}'. Load aborted. Use 'login ${manualStateData.user}' then 'loadstate'.`,
          {
            typeClass: this.config.CSS_CLASSES.WARNING_MSG,
          }
      );
      return {
        success: false,
        data: {
          message: `Saved state user mismatch. Current: ${currentUser.name}, Saved: ${manualStateData.user}.`,
        },
      };
    }

    return new Promise((resolve) => {
      this.dependencies.ModalManager.request({
        context: "terminal",
        messageLines: [
          `Load manually saved state for '${currentUser.name}'? This overwrites current session & filesystem.`,
        ],
        onConfirm: async () => {
          this.fsManager.setFsData(
              this.dependencies.Utils.deepCopyNode(manualStateData.fsDataSnapshot) || {
                [this.config.FILESYSTEM.ROOT_PATH]: {
                  type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                  children: {},
                  owner: manualStateData.user,
                  mode: this.config.FILESYSTEM.DEFAULT_DIR_MODE,
                  mtime: new Date().toISOString(),
                },
              }
          );
          this.fsManager.setCurrentPath(
              manualStateData.currentPath || this.config.FILESYSTEM.ROOT_PATH
          );
          if (this.elements.outputDiv)
            this.elements.outputDiv.innerHTML =
                manualStateData.outputHTML || "";
          this.terminalUI.setCurrentInputValue(
              manualStateData.currentInput || ""
          );
          this.dependencies.HistoryManager.setHistory(manualStateData.commandHistory || []);
          await this.fsManager.save(manualStateData.user);
          await this.outputManager.appendToOutput(
              this.config.MESSAGES.SESSION_LOADED_MSG,
              {
                typeClass: this.config.CSS_CLASSES.SUCCESS_MSG,
              }
          );
          this.terminalUI.updatePrompt();
          if (this.elements.outputDiv)
            this.elements.outputDiv.scrollTop =
                this.elements.outputDiv.scrollHeight;

          resolve({
            success: true,
            data: { message: this.config.MESSAGES.SESSION_LOADED_MSG },
          });
        },
        onCancel: () => {
          this.outputManager.appendToOutput(
              this.config.MESSAGES.LOAD_STATE_CANCELLED,
              {
                typeClass: this.config.CSS_CLASSES.CONSOLE_LOG_MSG,
              }
          );
          resolve({
            success: true,
            data: { message: this.config.MESSAGES.LOAD_STATE_CANCELLED },
          });
        },
        options,
      });
    });
  }

  /**
   * Clears all session and credential data for a specific user from storage.
   * @param {string} username - The username whose data to clear.
   * @returns {boolean} True if clearing was successful, false otherwise.
   */
  clearUserSessionStates(username) {
    if (!username || typeof username !== "string") {
      console.warn(
          "SessionManager.clearUserSessionStates: Invalid username provided.",
          username
      );
      return false;
    }
    try {
      this.storageManager.removeItem(this._getAutomaticSessionStateKey(username));
      this.storageManager.removeItem(this._getManualUserTerminalStateKey(username));
      const users = this.storageManager.loadItem(
          this.config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (users.hasOwnProperty(username)) {
        delete users[username];
        this.storageManager.saveItem(
            this.config.STORAGE_KEYS.USER_CREDENTIALS,
            users,
            "User list"
        );
      }
      return true;
    } catch (e) {
      console.error(`Error clearing session states for user '${username}':`, e);
      return false;
    }
  }

  /**
   * Performs a full system reset, clearing all local storage and IndexedDB data.
   * @returns {Promise<void>}
   */
  async performFullReset() {
    this.outputManager.clearOutput();
    this.terminalUI.clearInput();
    const allKeys = this.storageManager.getAllLocalStorageKeys();

    const OS_KEY_PREFIX = "oopisOs";

    allKeys.forEach((key) => {
      if (key.startsWith(OS_KEY_PREFIX)) {
        this.storageManager.removeItem(key);
      }
    });

    await this.outputManager.appendToOutput(
        "All session states, credentials, aliases, groups, and editor settings cleared from local storage."
    );
    try {
      await this.fsManager.clearAllFS();
      await this.outputManager.appendToOutput(
          "All user filesystems cleared from DB."
      );
    } catch (error) {
      await this.outputManager.appendToOutput(
          `Warning: Could not fully clear all user filesystems from DB. Error: ${error.message}`,
          {
            typeClass: this.config.CSS_CLASSES.WARNING_MSG,
          }
      );
    }
    await this.outputManager.appendToOutput(
        "Reset complete. Rebooting OopisOS...",
        {
          typeClass: this.config.CSS_CLASSES.SUCCESS_MSG,
        }
    );
    this.terminalUI.setInputState(false);
    if (this.elements.inputLineContainerDiv) {
      this.elements.inputLineContainerDiv.classList.add(
          this.config.CSS_CLASSES.HIDDEN
      );
    }
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
}