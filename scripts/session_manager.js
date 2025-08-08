// scripts/session_manager.js

class EnvironmentManager {
    constructor() { this.dependencies = {}; }
    setDependencies(userManager, fsManager, config) { this.dependencies = { userManager, fsManager, config }; }
    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) return OopisOS_Kernel.envManager;
        throw new Error("Python kernel for EnvironmentManager is not available.");
    }
    push() { this._getManager().push(); }
    pop() { this._getManager().pop(); }
    initialize() {
        const { userManager, config } = this.dependencies;
        const currentUser = userManager.getCurrentUser().name;
        const baseEnv = { "USER": currentUser, "HOME": `/home/${currentUser}`, "HOST": config.OS.DEFAULT_HOST_NAME, "PATH": "/bin:/usr/bin" };
        this.load(baseEnv);
    }
    get(varName) { try { return this._getManager().get(varName); } catch (e) { console.error(e); return ""; } }
    set(varName, value) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) return { success: false, error: `Invalid variable name: '${varName}'.` };
        try { this._getManager().set(varName, value); return { success: true }; } catch (e) { console.error(e); return { success: false, error: e.message }; }
    }
    unset(varName) { try { this._getManager().unset(varName); } catch (e) { console.error(e); } }
    getAll() {
        try {
            const pyProxy = this._getManager().get_all();
            const jsObject = pyProxy.toJs({ dict_converter: Object.fromEntries });
            pyProxy.destroy();
            return jsObject;
        } catch (e) { console.error(e); return {}; }
    }
    load(vars) { try { this._getManager().load(vars); } catch (e) { console.error(e); } }
}

class HistoryManager {
    constructor() { this.dependencies = {}; this.historyIndex = 0; this.jsHistoryCache = []; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) return OopisOS_Kernel.historyManager;
        throw new Error("Python kernel for HistoryManager is not available.");
    }
    _syncCache() { this.jsHistoryCache = this.getFullHistory(); this.historyIndex = this.jsHistoryCache.length; }
    add(command) { try { this._getManager().add(command); this._syncCache(); } catch (e) { console.error(e); } }
    getPrevious() {
        if (this.jsHistoryCache.length > 0 && this.historyIndex > 0) { this.historyIndex--; return this.jsHistoryCache[this.historyIndex]; }
        return null;
    }
    getNext() {
        if (this.historyIndex < this.jsHistoryCache.length - 1) { this.historyIndex++; return this.jsHistoryCache[this.historyIndex]; }
        else { this.historyIndex = this.jsHistoryCache.length; return ""; }
    }
    resetIndex() { this.historyIndex = this.jsHistoryCache.length; }
    getFullHistory() {
        try {
            const pyProxy = this._getManager().get_full_history();
            const jsArray = pyProxy.toJs();
            pyProxy.destroy();
            return jsArray;
        } catch (e) { console.error(e); return []; }
    }
    clearHistory() { try { this._getManager().clear_history(); this._syncCache(); } catch (e) { console.error(e); } }
    setHistory(newHistory) { try { this._getManager().set_history(newHistory); this._syncCache(); } catch (e) { console.error(e); } }
}

class AliasManager {
    constructor() { this.dependencies = {}; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) return OopisOS_Kernel.aliasManager;
        throw new Error("Python kernel for AliasManager is not available.");
    }
    initialize() {
        const allAliases = this.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
            const defaultAliases = { 'll': 'ls -la', 'la': 'ls -a', '..': 'cd ..', '...': 'cd ../..', 'h': 'history', 'c': 'clear', 'q': 'exit', 'e': 'edit', 'ex': 'explore' };
            this._getManager().load_aliases(defaultAliases);
        }
    }
    setAlias(name, value) { try { return this._getManager().set_alias(name, value); } catch (e) { console.error(e); return false; } }
    removeAlias(name) { try { return this._getManager().remove_alias(name); } catch (e) { console.error(e); return false; } }
    getAlias(name) { try { return this._getManager().get_alias(name); } catch (e) { console.error(e); return null; } }
    getAllAliases() {
        try {
            const pyProxy = this._getManager().get_all_aliases();
            const jsObject = pyProxy.toJs({ dict_converter: Object.fromEntries });
            pyProxy.destroy();
            return jsObject;
        } catch (e) { console.error(e); return {}; }
    }
    resolveAlias(commandString) {
        const { AliasManager } = this.dependencies;
        const parts = commandString.split(/\s+/); let commandName = parts[0];
        const remainingArgs = parts.slice(1).join(" "); const MAX_RECURSION = 10; let count = 0;
        let aliasValue = AliasManager.getAlias(commandName);
        while (aliasValue && count < MAX_RECURSION) {
            const aliasParts = aliasValue.split(/\s+/); commandName = aliasParts[0];
            const aliasArgs = aliasParts.slice(1).join(" ");
            commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
            count++; aliasValue = AliasManager.getAlias(commandName);
        }
        if (count === MAX_RECURSION) return { error: `Alias loop detected for '${parts[0]}'` };
        return { newCommand: commandString };
    }
}

class SessionManager {
    constructor() {
        this.elements = {}; this.dependencies = {}; this.config = null; this.fsManager = null;
        this.userManager = null; this.environmentManager = null; this.outputManager = null;
        this.terminalUI = null; this.storageManager = null;
    }

    _getManager() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) return OopisOS_Kernel.sessionManager;
        throw new Error("Python kernel for SessionManager is not available.");
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies; this.config = dependencies.Config;
        this.fsManager = dependencies.FileSystemManager; this.userManager = dependencies.UserManager;
        this.environmentManager = dependencies.EnvironmentManager; this.elements = dependencies.domElements;
        this.outputManager = dependencies.OutputManager; this.terminalUI = dependencies.TerminalUI;
        this.storageManager = dependencies.StorageManager;
    }

    initializeStack() { try { this._getManager().clear(this.config.USER.DEFAULT_NAME); } catch (e) { console.error("Failed to initialize session stack in Python:", e); } }
    getStack() { try { const pyProxy = this._getManager().get_stack(); const jsArray = pyProxy.toJs(); pyProxy.destroy(); return jsArray; } catch (e) { console.error("Failed to get session stack from Python:", e); return []; } }
    pushUserToStack(username) { try { this._getManager().push(username); } catch (e) { console.error("Failed to push user to session stack in Python:", e); } }
    popUserFromStack() { try { return this._getManager().pop(); } catch (e) { console.error("Failed to pop user from session stack in Python:", e); return null; } }
    getCurrentUserFromStack() { try { return this._getManager().get_current_user(); } catch (e) { console.error("Failed to get current user from session stack in Python:", e); return this.config.USER.DEFAULT_NAME; } }
    clearUserStack(username) { try { this._getManager().clear(username); } catch (e) { console.error("Failed to clear session stack in Python:", e); } }

    _getAutomaticSessionStateKey(user) { return `${this.config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`; }
    _getManualUserTerminalStateKey(user) { const userName = typeof user === "object" && user !== null && user.name ? user.name : String(user); return `${this.config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`; }

    saveAutomaticState(username) {
        if (!username) { console.warn("saveAutomaticState: No username provided."); return; }
        const sessionStateJson = OopisOS_Kernel.kernel.get_session_state_for_saving();
        const sessionState = JSON.parse(sessionStateJson);
        const uiState = {
            currentPath: this.fsManager.getCurrentPath(),
            outputHTML: this.elements.outputDiv ? this.elements.outputDiv.innerHTML : "",
            currentInput: this.terminalUI.getCurrentInputValue(),
        };
        const fullStateToSave = { ...sessionState, ...uiState };
        this.storageManager.saveItem(this._getAutomaticSessionStateKey(username), fullStateToSave, `Auto session for ${username}`);
    }

    async loadAutomaticState(username) {
        if (!username) { return false; }
        const loadedState = this.storageManager.loadItem(this._getAutomaticSessionStateKey(username), `Auto session for ${username}`);
        if (loadedState) {
            const sessionStateToLoad = {
                commandHistory: loadedState.commandHistory || [],
                environmentVariables: loadedState.environmentVariables || {},
                aliases: loadedState.aliases || {},
            };
            OopisOS_Kernel.kernel.load_session_state(JSON.stringify(sessionStateToLoad));
            this.fsManager.setCurrentPath(loadedState.currentPath || this.config.FILESYSTEM.ROOT_PATH);
            if (this.elements.outputDiv) { this.elements.outputDiv.innerHTML = loadedState.outputHTML || ""; }
            this.terminalUI.setCurrentInputValue(loadedState.currentInput || "");
        } else {
            if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
            this.terminalUI.setCurrentInputValue("");
            OopisOS_Kernel.kernel.load_session_state(JSON.stringify({}));
            const homePath = `/home/${username}`;
            this.fsManager.setCurrentPath(homePath);
            await this.outputManager.appendToOutput(`${this.config.MESSAGES.WELCOME_PREFIX} ${username}${this.config.MESSAGES.WELCOME_SUFFIX}`);
        }
        this.terminalUI.updatePrompt();
        if (this.elements.outputDiv) this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
        return !!loadedState;
    }

    async performFullReset() {
        const { IndexedDBManager } = this.dependencies;
        this.outputManager.clearOutput(); this.terminalUI.clearInput();
        try {
            localStorage.clear();
            await this.outputManager.appendToOutput("All session and configuration data has been cleared from localStorage.");
        } catch (e) {
            await this.outputManager.appendToOutput(`Warning: Could not fully clear localStorage. Error: ${e.message}`, { typeClass: this.config.CSS_CLASSES.WARNING_MSG });
        }
        try {
            await IndexedDBManager.deleteDatabase();
            await this.outputManager.appendToOutput("The SamwiseOS filesystem database has been successfully deleted.");
        } catch (error) {
            await this.outputManager.appendToOutput(`Warning: Could not delete the filesystem database. Error: ${error.message}`, { typeClass: this.config.CSS_CLASSES.WARNING_MSG });
        }
        await this.outputManager.appendToOutput("Factory reset complete. Rebooting SamwiseOS...", { typeClass: this.config.CSS_CLASSES.SUCCESS_MSG });
        this.terminalUI.setInputState(false);
        if (this.elements.inputLineContainerDiv) { this.elements.inputLineContainerDiv.classList.add(this.config.CSS_CLASSES.HIDDEN); }
        setTimeout(() => { window.location.reload(); }, 2000);
    }
}