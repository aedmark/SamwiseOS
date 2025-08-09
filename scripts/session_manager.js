// gem/scripts/session_manager.js

class EnvironmentManager {
    constructor() { this.dependencies = {}; }
    setDependencies(userManager, fsManager, config) { this.dependencies = { userManager, fsManager, config }; }
    push() { OopisOS_Kernel.syscall("env", "push"); }
    pop() { OopisOS_Kernel.syscall("env", "pop"); }
    initialize() {
        const { userManager, config } = this.dependencies;
        const currentUser = userManager.getCurrentUser().name;
        const baseEnv = { "USER": currentUser, "HOME": `/home/${currentUser}`, "HOST": config.OS.DEFAULT_HOST_NAME, "PATH": "/bin:/usr/bin" };
        this.load(baseEnv);
    }
    get(varName) {
        const result = JSON.parse(OopisOS_Kernel.syscall("env", "get", [varName]));
        return result.success ? result.data : "";
    }
    set(varName, value) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) return { success: false, error: `Invalid variable name: '${varName}'.` };
        const result = JSON.parse(OopisOS_Kernel.syscall("env", "set", [varName, value]));
        return result.success ? { success: true } : { success: false, error: result.error };
    }
    unset(varName) { OopisOS_Kernel.syscall("env", "unset", [varName]); }
    getAll() {
        const result = JSON.parse(OopisOS_Kernel.syscall("env", "get_all"));
        return result.success ? result.data : {};
    }
    load(vars) { OopisOS_Kernel.syscall("env", "load", [vars]); }
}

class HistoryManager {
    constructor() { this.dependencies = {}; this.historyIndex = 0; this.jsHistoryCache = []; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    _syncCache() { this.jsHistoryCache = this.getFullHistory(); this.historyIndex = this.jsHistoryCache.length; }
    add(command) { OopisOS_Kernel.syscall("history", "add", [command]); this._syncCache(); }
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
        const result = JSON.parse(OopisOS_Kernel.syscall("history", "get_full_history"));
        return result.success ? result.data : [];
    }
    clearHistory() { OopisOS_Kernel.syscall("history", "clear_history"); this._syncCache(); }
    setHistory(newHistory) { OopisOS_Kernel.syscall("history", "set_history", [newHistory]); this._syncCache(); }
}

class AliasManager {
    constructor() { this.dependencies = {}; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    initialize() {
        const allAliases = this.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
            const defaultAliases = { 'll': 'ls -la', 'la': 'ls -a', '..': 'cd ..', '...': 'cd ../..', 'h': 'history', 'c': 'clear', 'q': 'exit', 'e': 'edit', 'ex': 'explore' };
            OopisOS_Kernel.syscall("alias", "load_aliases", [defaultAliases]);
        }
    }
    setAlias(name, value) { return JSON.parse(OopisOS_Kernel.syscall("alias", "set_alias", [name, value])).success; }
    removeAlias(name) { return JSON.parse(OopisOS_Kernel.syscall("alias", "remove_alias", [name])).success; }
    getAlias(name) {
        const result = JSON.parse(OopisOS_Kernel.syscall("alias", "get_alias", [name]));
        return result.success ? result.data : null;
    }
    getAllAliases() {
        const result = JSON.parse(OopisOS_Kernel.syscall("alias", "get_all_aliases"));
        return result.success ? result.data : {};
    }
    resolveAlias(commandString) {
        // This logic is pure JS and doesn't need to change as it calls the public API above.
        const { AliasManager } = this.dependencies;
        const parts = commandString.split(/\s+/); let commandName = parts[0];
        const remainingArgs = parts.slice(1).join(" "); const MAX_RECURSION = 10; let count = 0;
        let aliasValue = this.getAlias(commandName);
        while (aliasValue && count < MAX_RECURSION) {
            const aliasParts = aliasValue.split(/\s+/); commandName = aliasParts[0];
            const aliasArgs = aliasParts.slice(1).join(" ");
            commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
            count++; aliasValue = this.getAlias(commandName);
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

    setDependencies(dependencies) {
        this.dependencies = dependencies; this.config = dependencies.Config;
        this.fsManager = dependencies.FileSystemManager; this.userManager = dependencies.UserManager;
        this.environmentManager = dependencies.EnvironmentManager; this.elements = dependencies.domElements;
        this.outputManager = dependencies.OutputManager; this.terminalUI = dependencies.TerminalUI;
        this.storageManager = dependencies.StorageManager;
    }

    initializeStack() { OopisOS_Kernel.syscall("session", "clear", [this.config.USER.DEFAULT_NAME]); }
    getStack() {
        const result = JSON.parse(OopisOS_Kernel.syscall("session", "get_stack"));
        return result.success ? result.data : [];
    }
    pushUserToStack(username) { OopisOS_Kernel.syscall("session", "push", [username]); }
    popUserFromStack() {
        const result = JSON.parse(OopisOS_Kernel.syscall("session", "pop"));
        return result.success ? result.data : null;
    }
    getCurrentUserFromStack() {
        const result = JSON.parse(OopisOS_Kernel.syscall("session", "get_current_user"));
        return result.success ? result.data : this.config.USER.DEFAULT_NAME;
    }
    clearUserStack(username) { OopisOS_Kernel.syscall("session", "clear", [username]); }

    _getAutomaticSessionStateKey(user) { return `${this.config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`; }
    _getManualUserTerminalStateKey(user) { const userName = typeof user === "object" && user !== null && user.name ? user.name : String(user); return `${this.config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`; }

    saveAutomaticState(username) {
        if (!username) { console.warn("saveAutomaticState: No username provided."); return; }
        const result = JSON.parse(OopisOS_Kernel.syscall("session", "get_session_state_for_saving"));
        const sessionState = result.success ? JSON.parse(result.data) : {};
        const uiState = {
            currentPath: this.fsManager.getCurrentPath(),
            outputHTML: this.elements.outputDiv ? this.elements.outputDiv.innerHTML : "",
            currentInput: this.terminalUI.getCurrentInputValue(),
        };
        const fullStateToSave = { ...sessionState, ...uiState };
        this.storageManager.saveItem(this._getAutomaticSessionStateKey(username), fullStateToSave, `Auto session for ${username}`);
    }

    async loadAutomaticState(username) {
        if (!username) { return { success: false, newStateCreated: false }; }
        const loadedState = this.storageManager.loadItem(this._getAutomaticSessionStateKey(username), `Auto session for ${username}`);
        if (loadedState) {
            this.fsManager.setCurrentPath(loadedState.currentPath || this.config.FILESYSTEM.ROOT_PATH);
            if (this.elements.outputDiv) { this.elements.outputDiv.innerHTML = loadedState.outputHTML || ""; }
            this.terminalUI.setCurrentInputValue(loadedState.currentInput || "");
            this.terminalUI.updatePrompt();
            if (this.elements.outputDiv) this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
            // Return that we successfully loaded an existing state
            return { success: true, newStateCreated: false };
        } else {
            // This is a new session for this user.
            if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
            this.terminalUI.setCurrentInputValue("");
            OopisOS_Kernel.syscall("session", "load_session_state", [JSON.stringify({})]);
            const homePath = `/home/${username}`;
            this.fsManager.setCurrentPath(homePath);
            this.terminalUI.updatePrompt();
            // Return that we created a new state. DO NOT print a welcome message here.
            return { success: true, newStateCreated: true };
        }
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