// gem/scripts/session_manager.js

class EnvironmentManager {
    constructor() { this.dependencies = {}; }
    setDependencies(userManager, fsManager, config) { this.dependencies = { userManager, fsManager, config }; }
    async push() { await OopisOS_Kernel.syscall("env", "push"); }
    async pop() { await OopisOS_Kernel.syscall("env", "pop"); }
    async initialize() {
        const { userManager, config } = this.dependencies;
        const currentUser = (await userManager.getCurrentUser()).name;
        const baseEnv = { "USER": currentUser, "HOME": `/home/${currentUser}`, "HOST": config.OS.DEFAULT_HOST_NAME, "PATH": "/bin:/usr/bin", "PS1": "\\u@\\h:\\w\\$ " };
        await this.load(baseEnv);
    }
    async get(varName) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("env", "get", [varName]));
        return result.success ? result.data : "";
    }
    async set(varName, value) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) return { success: false, error: `Invalid variable name: '${varName}'.` };
        const result = JSON.parse(await OopisOS_Kernel.syscall("env", "set", [varName, value]));
        return result.success ? { success: true } : { success: false, error: result.error };
    }
    async unset(varName) { await OopisOS_Kernel.syscall("env", "unset", [varName]); }
    async getAll() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("env", "get_all"));
        return result.success ? result.data : {};
    }
    async load(vars) { await OopisOS_Kernel.syscall("env", "load", [vars]); }
}

class HistoryManager {
    constructor() { this.dependencies = {}; this.historyIndex = 0; this.jsHistoryCache = []; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    async _syncCache() { this.jsHistoryCache = await this.getFullHistory(); this.historyIndex = this.jsHistoryCache.length; }
    async add(command) { await OopisOS_Kernel.syscall("history", "add", [command]); await this._syncCache(); }
    getPrevious() {
        if (this.jsHistoryCache.length > 0 && this.historyIndex > 0) { this.historyIndex--; return this.jsHistoryCache[this.historyIndex]; }
        return null;
    }
    getNext() {
        if (this.historyIndex < this.jsHistoryCache.length - 1) { this.historyIndex++; return this.jsHistoryCache[this.historyIndex]; }
        else { this.historyIndex = this.jsHistoryCache.length; return ""; }
    }
    resetIndex() { this.historyIndex = this.jsHistoryCache.length; }
    async getFullHistory() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("history", "get_full_history"));
        return result.success ? result.data : [];
    }
    async clearHistory() { await OopisOS_Kernel.syscall("history", "clear_history"); await this._syncCache(); }
    async setHistory(newHistory) { await OopisOS_Kernel.syscall("history", "set_history", [newHistory]); await this._syncCache(); }
}

class AliasManager {
    constructor() { this.dependencies = {}; }
    setDependencies(injectedDependencies) { this.dependencies = injectedDependencies; }
    async initialize() {
        const allAliases = await this.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
            const defaultAliases = { 'll': 'ls -la', 'la': 'ls -a', '..': 'cd ..', '...': 'cd ../..', 'h': 'history', 'c': 'clear', 'q': 'exit', 'e': 'edit', 'ex': 'explore' };
            await OopisOS_Kernel.syscall("alias", "load_aliases", [defaultAliases]);
        }
    }
    async setAlias(name, value) { return JSON.parse(await OopisOS_Kernel.syscall("alias", "set_alias", [name, value])).success; }
    async removeAlias(name) { return JSON.parse(await OopisOS_Kernel.syscall("alias", "remove_alias", [name])).success; }
    async getAlias(name) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "get_alias", [name]));
        return result.success ? result.data : null;
    }
    async getAllAliases() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "get_all_aliases"));
        return result.success ? result.data : {};
    }
    async resolveAlias(commandString) {
        const { AliasManager } = this.dependencies;
        const parts = commandString.split(/\s+/); let commandName = parts[0];
        const remainingArgs = parts.slice(1).join(" "); const MAX_RECURSION = 10; let count = 0;
        let aliasValue = await this.getAlias(commandName);
        while (aliasValue && count < MAX_RECURSION) {
            const aliasParts = aliasValue.split(/\s+/); commandName = aliasParts[0];
            const aliasArgs = aliasParts.slice(1).join(" ");
            commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
            count++; aliasValue = await this.getAlias(commandName);
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

    async initializeStack() { await OopisOS_Kernel.syscall("session", "clear", [this.config.USER.DEFAULT_NAME]); }
    async getStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "get_stack"));
        return result.success ? result.data : [];
    }
    async pushUserToStack(username) { await OopisOS_Kernel.syscall("session", "push", [username]); }
    async popUserFromStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "pop"));
        return result.success ? result.data : null;
    }
    async getCurrentUserFromStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "get_current_user"));
        return result.success ? result.data : this.config.USER.DEFAULT_NAME;
    }
    async clearUserStack(username) { await OopisOS_Kernel.syscall("session", "clear", [username]); }

    _getAutomaticSessionStateKey(user) { return `${this.config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`; }
    _getManualUserTerminalStateKey(user) { const userName = typeof user === "object" && user !== null && user.name ? user.name : String(user); return `${this.config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`; }

    async syncAndSave(effectData) {
        const { AliasManager, EnvironmentManager, StorageManager, Config, UserManager } = this.dependencies;
        if (effectData.aliases) {
            await OopisOS_Kernel.syscall("alias", "load_aliases", [effectData.aliases]);
            StorageManager.saveItem(Config.STORAGE_KEYS.ALIAS_DEFINITIONS, effectData.aliases, "Aliases");
        }
        if (effectData.env) {
            await OopisOS_Kernel.syscall("env", "load", [effectData.env]);
            await this.saveAutomaticState((await UserManager.getCurrentUser()).name);
        }
    }

    async saveAutomaticState(username) {
        if (!username) {
            console.warn("saveAutomaticState: No username provided.");
            return;
        }
        const { HistoryManager, EnvironmentManager, AliasManager } = this.dependencies;
        const sessionState = {
            commandHistory: await HistoryManager.getFullHistory(),
            environmentVariables: await EnvironmentManager.getAll(),
            aliases: await AliasManager.getAllAliases(),
        };
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
        await OopisOS_Kernel.syscall("session", "load_session_state", [JSON.stringify(loadedState || {})]);
        if (loadedState) {
            this.fsManager.setCurrentPath(loadedState.currentPath || this.config.FILESYSTEM.ROOT_PATH);
            if (this.elements.outputDiv) { this.elements.outputDiv.innerHTML = loadedState.outputHTML || ""; }
            this.terminalUI.setCurrentInputValue(loadedState.currentInput || "");
            await this.terminalUI.updatePrompt();
            if (this.elements.outputDiv) this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
            return { success: true, newStateCreated: false };
        } else {
            if (this.elements.outputDiv) this.elements.outputDiv.innerHTML = "";
            this.terminalUI.setCurrentInputValue("");
            const homePath = `/home/${username}`;
            this.fsManager.setCurrentPath(homePath);
            const currentNode = await this.fsManager.getNodeByPath(this.fsManager.getCurrentPath());
            if (!currentNode) {
                this.fsManager.setCurrentPath(this.config.FILESYSTEM.ROOT_PATH);
            }
            await this.terminalUI.updatePrompt();
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