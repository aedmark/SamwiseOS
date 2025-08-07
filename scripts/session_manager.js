// scripts/session_manager.js

/**
 * @class EnvironmentManager
 * @description An API client for the OopisOS Python Environment Manager kernel.
 * All core logic and state are now handled by `core/session.py`.
 */
class EnvironmentManager {
    constructor() {
        this.dependencies = {};
    }

    setDependencies(userManager, fsManager, config) {
        this.dependencies = { userManager, fsManager, config };
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.envManager;
        }
        throw new Error("Python kernel for EnvironmentManager is not available.");
    }

    push() { this._getManager().push(); }
    pop() { this._getManager().pop(); }

    initialize() {
        const { userManager, config } = this.dependencies;
        const currentUser = userManager.getCurrentUser().name;
        const baseEnv = {
            "USER": currentUser,
            "HOME": `/home/${currentUser}`,
            "HOST": config.OS.DEFAULT_HOST_NAME,
            "PATH": "/bin:/usr/bin"
        };
        this.load(baseEnv);
    }

    get(varName) {
        try {
            return this._getManager().get(varName);
        } catch (e) {
            console.error(e);
            return "";
        }
    }

    set(varName, value) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            return { success: false, error: `Invalid variable name: '${varName}'.` };
        }
        try {
            this._getManager().set(varName, value);
            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        }
    }

    unset(varName) {
        try {
            this._getManager().unset(varName);
        } catch (e) {
            console.error(e);
        }
    }

    getAll() {
        try {
            const pyProxy = this._getManager().get_all();
            const jsObject = pyProxy.toJs({ dict_converter: Object.fromEntries });
            pyProxy.destroy();
            return jsObject;
        } catch (e) {
            console.error(e);
            return {};
        }
    }

    load(vars) {
        try {
            this._getManager().load(vars);
        } catch (e) {
            console.error(e);
        }
    }
}

/**
 * @class HistoryManager
 * @description An API client for the OopisOS Python History Manager kernel.
 * All core logic and state are now handled by `core/session.py`.
 */
class HistoryManager {
    constructor() {
        this.dependencies = {};
        this.historyIndex = 0; // JS-side navigation index
        this.jsHistoryCache = []; // Cache for navigation
    }

    setDependencies(injectedDependencies) {
        this.dependencies = injectedDependencies;
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.historyManager;
        }
        throw new Error("Python kernel for HistoryManager is not available.");
    }

    _syncCache() {
        this.jsHistoryCache = this.getFullHistory();
        this.historyIndex = this.jsHistoryCache.length;
    }

    add(command) {
        try {
            this._getManager().add(command);
            this._syncCache();
        } catch (e) {
            console.error(e);
        }
    }

    getPrevious() {
        if (this.jsHistoryCache.length > 0 && this.historyIndex > 0) {
            this.historyIndex--;
            return this.jsHistoryCache[this.historyIndex];
        }
        return null;
    }

    getNext() {
        if (this.historyIndex < this.jsHistoryCache.length - 1) {
            this.historyIndex++;
            return this.jsHistoryCache[this.historyIndex];
        } else {
            this.historyIndex = this.jsHistoryCache.length;
            return "";
        }
    }

    resetIndex() {
        this.historyIndex = this.jsHistoryCache.length;
    }

    getFullHistory() {
        try {
            const pyProxy = this._getManager().get_full_history();
            const jsArray = pyProxy.toJs();
            pyProxy.destroy();
            return jsArray;
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    clearHistory() {
        try {
            this._getManager().clear_history();
            this._syncCache();
        } catch (e) {
            console.error(e);
        }
    }

    setHistory(newHistory) {
        try {
            this._getManager().set_history(newHistory);
            this._syncCache();
        } catch (e) {
            console.error(e);
        }
    }
}

/**
 * @class AliasManager
 * @description An API client for the OopisOS Python Alias Manager kernel.
 * All core logic and state are now handled by `core/session.py`.
 */
class AliasManager {
    constructor() {
        this.dependencies = {};
    }

    setDependencies(injectedDependencies) {
        this.dependencies = injectedDependencies;
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.aliasManager;
        }
        throw new Error("Python kernel for AliasManager is not available.");
    }

    initialize() {
        const allAliases = this.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
            const defaultAliases = { 'll': 'ls -la', 'la': 'ls -a', '..': 'cd ..', '...': 'cd ../..', 'h': 'history', 'c': 'clear', 'q': 'exit', 'e': 'edit', 'ex': 'explore' };
            this._getManager().load_aliases(defaultAliases);
        }
    }

    setAlias(name, value) {
        try {
            return this._getManager().set_alias(name, value);
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    removeAlias(name) {
        try {
            return this._getManager().remove_alias(name);
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    getAlias(name) {
        try {
            return this._getManager().get_alias(name);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    getAllAliases() {
        try {
            const pyProxy = this._getManager().get_all_aliases();
            const jsObject = pyProxy.toJs({ dict_converter: Object.fromEntries });
            pyProxy.destroy();
            return jsObject;
        } catch (e) {
            console.error(e);
            return {};
        }
    }

    resolveAlias(commandString) {
        const { AliasManager } = this.dependencies;
        const parts = commandString.split(/\s+/);
        let commandName = parts[0];
        const remainingArgs = parts.slice(1).join(" ");
        const MAX_RECURSION = 10;
        let count = 0;

        let aliasValue = AliasManager.getAlias(commandName);
        while (aliasValue && count < MAX_RECURSION) {
            const aliasParts = aliasValue.split(/\s+/);
            commandName = aliasParts[0];
            const aliasArgs = aliasParts.slice(1).join(" ");
            commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
            count++;
            aliasValue = AliasManager.getAlias(commandName);
        }

        if (count === MAX_RECURSION) {
            return { error: `Alias loop detected for '${parts[0]}'` };
        }
        return { newCommand: commandString };
    }
}


/**
 * @class SessionManager
 * @classdesc [MODIFIED] Manages user sessions, delegating stack management to Python.
 * State persistence (saving/loading screen state) remains in JavaScript.
 */
class SessionManager {
    /**
     * Initializes the SessionManager.
     */
    constructor() {
        this.elements = {};
        this.dependencies = {};
        this.config = null;
        this.fsManager = null;
        this.userManager = null;
        this.environmentManager = null;
        this.outputManager = null;
        this.terminalUI = null;
        this.storageManager = null;
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            return OopisOS_Kernel.sessionManager;
        }
        throw new Error("Python kernel for SessionManager is not available.");
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

    initializeStack() {
        try {
            this._getManager().clear(this.config.USER.DEFAULT_NAME);
        } catch (e) {
            console.error("Failed to initialize session stack in Python:", e);
        }
    }

    getStack() {
        try {
            const pyProxy = this._getManager().get_stack();
            const jsArray = pyProxy.toJs();
            pyProxy.destroy();
            return jsArray;
        } catch (e) {
            console.error("Failed to get session stack from Python:", e);
            return [];
        }
    }

    pushUserToStack(username) {
        try {
            this._getManager().push(username);
        } catch (e) {
            console.error("Failed to push user to session stack in Python:", e);
        }
    }

    popUserFromStack() {
        try {
            return this._getManager().pop();
        } catch (e) {
            console.error("Failed to pop user from session stack in Python:", e);
            return null;
        }
    }

    getCurrentUserFromStack() {
        try {
            return this._getManager().get_current_user();
        } catch (e) {
            console.error("Failed to get current user from session stack in Python:", e);
            return this.config.USER.DEFAULT_NAME;
        }
    }

    clearUserStack(username) {
        try {
            this._getManager().clear(username);
        } catch (e) {
            console.error("Failed to clear session stack in Python:", e);
        }
    }

    // ... (All save/load state methods like saveAutomaticState, loadAutomaticState, etc., remain unchanged) ...
    _getAutomaticSessionStateKey(user) {
        return `${this.config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`;
    }

    _getManualUserTerminalStateKey(user) {
        const userName =
            typeof user === "object" && user !== null && user.name
                ? user.name
                : String(user);
        return `${this.config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`;
    }

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
            aliases: this.dependencies.AliasManager.getAllAliases(),
        };
        this.storageManager.saveItem(
            this._getAutomaticSessionStateKey(username),
            autoState,
            `Auto session for ${username}`
        );
    }

    async loadAutomaticState(username) {
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
            OopisOS_Kernel.aliasManager.load_aliases(autoState.aliases || {});
        } else {
            if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
            this.terminalUI.setCurrentInputValue("");
            const homePath = `/home/${username}`;
            let homeNode = await this.fsManager.getNodeByPath(homePath);

            // If home directory doesn't exist on first load, create it.
            if (!homeNode) {
                await this.fsManager.createOrUpdateFile(homePath, null, {
                    isDirectory: true,
                    currentUser: username,
                    primaryGroup: username,
                });
                homeNode = await this.fsManager.getNodeByPath(homePath);
            }

            this.fsManager.setCurrentPath(
                homeNode ? homePath : this.config.FILESYSTEM.ROOT_PATH
            );
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

    async performFullReset() {
        const { IndexedDBManager } = this.dependencies;
        this.outputManager.clearOutput();
        this.terminalUI.clearInput();

        // Wipe everything from localStorage
        try {
            localStorage.clear();
            await this.outputManager.appendToOutput("All session and configuration data has been cleared from localStorage.");
        } catch (e) {
            await this.outputManager.appendToOutput(`Warning: Could not fully clear localStorage. Error: ${e.message}`, {
                typeClass: this.config.CSS_CLASSES.WARNING_MSG,
            });
        }

        // Delete the entire IndexedDB database
        try {
            await IndexedDBManager.deleteDatabase();
            await this.outputManager.appendToOutput("The SamwiseOS filesystem database has been successfully deleted.");
        } catch (error) {
            await this.outputManager.appendToOutput(
                `Warning: Could not delete the filesystem database. It might be in use by another tab. Error: ${error.message}`,
                {
                    typeClass: this.config.CSS_CLASSES.WARNING_MSG,
                }
            );
        }

        await this.outputManager.appendToOutput(
            "Factory reset complete. Rebooting SamwiseOS...",
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
        }, 2000);
    }
}