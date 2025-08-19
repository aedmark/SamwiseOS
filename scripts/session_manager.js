// gemini/scripts/session_manager.js

class EnvironmentManager {
    constructor() { this.dependencies = {}; }
    setDependencies(deps) { this.dependencies = deps; }
    async push() { await OopisOS_Kernel.syscall("env", "push"); }
    async pop() { await OopisOS_Kernel.syscall("env", "pop"); }
    async initialize(userContext) { await OopisOS_Kernel.syscall("env", "initialize_defaults", [userContext]); }
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
    constructor() {
        this.dependencies = {};
        this.historyIndex = 0;
        this.jsHistoryCache = [];
        this.searchIndex = -1; // New: For reverse search
    }
    setDependencies(deps) { this.dependencies = deps; }
    async _syncCache() {
        this.jsHistoryCache = await this.getFullHistory();
        this.historyIndex = this.jsHistoryCache.length;
    }
    async add(command) {
        await OopisOS_Kernel.syscall("history", "add", [command]);
        await this._syncCache();
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
    resetIndex() { this.historyIndex = this.jsHistoryCache.length; this.searchIndex = -1; }
    async getFullHistory() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("history", "get_full_history"));
        return result.success ? result.data : [];
    }
    async clearHistory() {
        await OopisOS_Kernel.syscall("history", "clear_history");
        await this._syncCache();
    }
    async setHistory(newHistory) {
        await OopisOS_Kernel.syscall("history", "set_history", [newHistory]);
        await this._syncCache();
    }
    search(query, startFromLast = false) {
        if (startFromLast || this.searchIndex === -1) {
            this.searchIndex = this.jsHistoryCache.length - 1;
        } else {
            this.searchIndex--;
        }

        for (let i = this.searchIndex; i >= 0; i--) {
            if (this.jsHistoryCache[i].toLowerCase().includes(query.toLowerCase())) {
                this.searchIndex = i;
                return this.jsHistoryCache[i];
            }
        }
        // If we reach the beginning without a match, reset for the next cycle
        this.searchIndex = -1;
        return null;
    }
}

class AliasManager {
    constructor() { this.dependencies = {}; }
    setDependencies(deps) { this.dependencies = deps; }
    async initialize() {
        const allAliases = await this.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
            await OopisOS_Kernel.syscall("alias", "initialize_defaults");
        }
    }
    async setAlias(name, value) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "set_alias", [name, value]));
        return result.success;
    }
    async removeAlias(name) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "remove_alias", [name]));
        return result.success;
    }
    async getAlias(name) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "get_alias", [name]));
        return result.success ? result.data : null;
    }
    async getAllAliases() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("alias", "get_all_aliases"));
        return result.success ? result.data : {};
    }
}

class SessionManager {
    constructor() { this.dependencies = {}; }
    setDependencies(deps) { this.dependencies = deps; }

    async initializeStack() { await OopisOS_Kernel.syscall("session", "clear", ["Guest"]); }
    async getStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "get_stack"));
        return result.success ? result.data : ["Guest"];
    }
    async pushUserToStack(username) { await OopisOS_Kernel.syscall("session", "push", [username]); }
    async popUserFromStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "pop"));
        return result.success ? result.data : null;
    }
    async getCurrentUserFromStack() {
        const result = JSON.parse(await OopisOS_Kernel.syscall("session", "get_current_user"));
        return result.success ? result.data : "Guest";
    }

    _getAutomaticSessionStateKey(user) { return `${this.dependencies.Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`; }

    async saveAutomaticState(username) {
        if (!username) return;
        const { FileSystemManager, TerminalUI, StorageManager } = this.dependencies;
        const pythonStateResult = JSON.parse(await OopisOS_Kernel.syscall("session", "get_session_state_for_saving"));
        const pythonState = pythonStateResult.data || {};

        const uiState = {
            currentPath: FileSystemManager.getCurrentPath(),
            outputHTML: TerminalUI.elements.outputDiv ? TerminalUI.elements.outputDiv.innerHTML : "",
            currentInput: TerminalUI.getCurrentInputValue(),
        };

        const fullStateToSave = { ...pythonState, ...uiState };
        StorageManager.saveItem(this._getAutomaticSessionStateKey(username), fullStateToSave, `Auto session for ${username}`);
    }

    async loadAutomaticState(username) {
        const { FileSystemManager, TerminalUI, StorageManager, Config, AliasManager, EnvironmentManager, HistoryManager } = this.dependencies;
        const stateKey = this._getAutomaticSessionStateKey(username);
        const loadedState = StorageManager.loadItem(stateKey, `Auto session for ${username}`);

        if (loadedState) {
            const sessionPart = {
                commandHistory: loadedState.commandHistory || [],
                environmentVariables: loadedState.environmentVariables || {},
                aliases: loadedState.aliases || {},
            };
            await OopisOS_Kernel.syscall("session", "load_session_state", [JSON.stringify(sessionPart)]);

            FileSystemManager.setCurrentPath(loadedState.currentPath || Config.FILESYSTEM.ROOT_PATH);
            if (TerminalUI.elements.outputDiv) { TerminalUI.elements.outputDiv.innerHTML = loadedState.outputHTML || ""; }
            TerminalUI.setCurrentInputValue(loadedState.currentInput || "");
            await TerminalUI.updatePrompt();
            if (TerminalUI.elements.outputDiv) TerminalUI.elements.outputDiv.scrollTop = TerminalUI.elements.outputDiv.scrollHeight;

            await HistoryManager._syncCache();

            return { success: true, newStateCreated: false };
        } else {
            if (TerminalUI.elements.outputDiv) { TerminalUI.elements.outputDiv.innerHTML = ""; }
            TerminalUI.setCurrentInputValue("");

            await AliasManager.initialize();
            await EnvironmentManager.initialize({ name: username });
            await HistoryManager.clearHistory();

            const homePath = `/home/${username}`;
            const homeNodeExists = await FileSystemManager.getNodeByPath(homePath);
            FileSystemManager.setCurrentPath(homeNodeExists ? homePath : Config.FILESYSTEM.ROOT_PATH);

            await TerminalUI.updatePrompt();
            return { success: true, newStateCreated: true };
        }
    }
}