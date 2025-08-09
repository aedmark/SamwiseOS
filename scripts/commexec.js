// gem/scripts/commexec.js

/**
 * [REFACTORED] The central nervous system of OopisOS. This class has been refactored
 * to act as a bridge to the Python kernel's command executor. It is now responsible for
 * gathering context, passing the raw command string to Python, and handling any UI/session
 * "effects" returned by the Python kernel.
 * @class CommandExecutor
 */
class CommandExecutor {
    /**
     * @constructor
     */
    constructor() {
        this.backgroundProcessIdCounter = 0;
        this.activeJobs = {};
        this.loadedScripts = new Set();
        this.dependencies = {};
        this.isInDreamatorium = false;
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    _loadScript(scriptPath) {
        if (this.loadedScripts.has(scriptPath)) {
            return Promise.resolve(true);
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `./scripts/${scriptPath}`;
            script.onload = () => { this.loadedScripts.add(scriptPath); resolve(true); };
            script.onerror = () => { reject(new Error(`Failed to fetch script: ${scriptPath}`)); };
            document.head.appendChild(script);
        });
    }

    async _ensureCommandLoaded(commandName) {
        const { Config, OutputManager, CommandRegistry, FileSystemManager } = this.dependencies;
        if (!commandName || typeof commandName !== "string") return null;
        const existingCommand = CommandRegistry.getCommands()[commandName];
        if (existingCommand) { return existingCommand; }
        if (Config.COMMANDS_MANIFEST.includes(commandName)) {
            const commandScriptPath = `commands/${commandName}.js`;
            try {
                await this._loadScript(commandScriptPath);
                const commandInstance = CommandRegistry.getCommands()[commandName];
                if (!commandInstance) {
                    await OutputManager.appendToOutput(`Error: Script loaded but command '${commandName}' failed to register.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    return null;
                }
                const definition = commandInstance.definition;
                if (definition.dependencies && Array.isArray(definition.dependencies)) {
                    for (const dep of definition.dependencies) { await this._loadScript(dep); }
                }
                return commandInstance;
            } catch (error) {
                const vfsPath = `/bin/${commandName}`;
                const packageNode = await FileSystemManager.getNodeByPath(vfsPath);
                if (packageNode && packageNode.type === 'file') {
                    try {
                        const scriptElement = document.createElement('script');
                        scriptElement.textContent = packageNode.content;
                        document.head.appendChild(scriptElement);
                        document.head.removeChild(scriptElement);
                        const commandInstance = CommandRegistry.getCommands()[commandName];
                        if (!commandInstance) {
                            await OutputManager.appendToOutput(`Error: Package '${commandName}' failed to register.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                            return null;
                        }
                        return commandInstance;
                    } catch (e) {
                        await OutputManager.appendToOutput(`Error: Failed to execute package '${commandName}'. ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                        return null;
                    }
                } else {
                    await OutputManager.appendToOutput(`Error: Command '${commandName}' could not be loaded. ${error.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    return null;
                }
            }
        }
        return null;
    }

    getActiveJobs() { return this.activeJobs; }

    sendSignalToJob(jobId, signal) {
        const { ErrorHandler } = this.dependencies;
        const job = this.activeJobs[jobId];
        if (!job) { return ErrorHandler.createError(`Job ${jobId} not found.`); }
        switch (signal.toUpperCase()) {
            case 'KILL': case 'TERM':
                if (job.abortController) {
                    job.abortController.abort("Killed by user command.");
                    delete this.activeJobs[jobId];
                    this.dependencies.MessageBusManager.unregisterJob(jobId);
                }
                break;
            case 'STOP': job.status = 'paused'; break;
            case 'CONT': job.status = 'running'; break;
            default: return ErrorHandler.createError(`Invalid signal '${signal}'.`);
        }
        return ErrorHandler.createSuccess(`Signal ${signal} sent to job ${jobId}.`);
    }

    async executeScript(lines, options = {}) {
        const { ErrorHandler, EnvironmentManager, Config } = this.dependencies;
        EnvironmentManager.push();
        const scriptingContext = { isScripting: true, lines: lines, currentLineIndex: -1, args: options.args || [], };
        let stepCounter = 0; const MAX_STEPS = Config.FILESYSTEM.MAX_SCRIPT_STEPS || 10000;
        try {
            for (let i = 0; i < lines.length; i++) {
                stepCounter++; if (stepCounter > MAX_STEPS) { throw new Error(`Maximum script execution steps (${MAX_STEPS}) exceeded.`); }
                scriptingContext.currentLineIndex = i;
                const line = lines[i].trim();
                if (line && !line.startsWith("#")) {
                    const result = await this.processSingleCommand(line, { ...options, scriptingContext, });
                    i = scriptingContext.currentLineIndex;
                    if (!result.success) { throw new Error(`Error on line ${i + 1}: ${result.error || 'Unknown error'}`); }
                }
            }
        } finally { EnvironmentManager.pop(); }
        return ErrorHandler.createSuccess("Script finished successfully.");
    }

    _expandBraces(commandString) {
        const braceExpansionRegex = /(\S*?)\{([^}]+)\}(\S*)/g;
        const expander = (match, prefix, content, suffix) => {
            if (content.includes('..')) {
                const [start, end] = content.split('..'); const startNum = parseInt(start, 10); const endNum = parseInt(end, 10);
                if (!isNaN(startNum) && !isNaN(endNum)) {
                    const result = []; const step = startNum <= endNum ? 1 : -1;
                    for (let i = startNum; step > 0 ? i <= endNum : i >= endNum; i += step) { result.push(`${prefix}${i}${suffix}`); }
                    return result.join(' ');
                } else if (start.length === 1 && end.length === 1) {
                    const startCode = start.charCodeAt(0); const endCode = end.charCodeAt(0); const result = []; const step = startCode <= endCode ? 1 : -1;
                    for (let i = startCode; step > 0 ? i <= endCode : i >= endCode; i += step) { result.push(`${prefix}${String.fromCharCode(i)}${suffix}`); }
                    return result.join(' ');
                }
            } else if (content.includes(',')) { return content.split(',').map(part => `${prefix}${part}${suffix}`).join(' '); }
            return match;
        };
        let expandedString = commandString; let previousString;
        do { previousString = expandedString; expandedString = expandedString.replace(braceExpansionRegex, expander); } while (expandedString !== previousString);
        return expandedString;
    }

    async _preprocessCommandString(rawCommandText, scriptingContext = null) {
        const { EnvironmentManager, AliasManager } = this.dependencies;
        let commandToProcess = rawCommandText.trim();
        commandToProcess = this._expandBraces(commandToProcess);
        const assignmentSubstitutionRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)=\$\(([^)]+)\)$/;
        const assignmentMatch = commandToProcess.match(assignmentSubstitutionRegex);
        if (assignmentMatch) {
            const varName = assignmentMatch[1]; const subCommand = assignmentMatch[2];
            const result = await this.processSingleCommand(subCommand, { isInteractive: false, suppressOutput: true });
            const output = result.success ? (result.output || '').trim().replace(/\n/g, ' ') : '';
            EnvironmentManager.set(varName, output); return "";
        }
        const commandSubstitutionRegex = /\$\(([^)]+)\)/g;
        let inlineMatch;
        while ((inlineMatch = commandSubstitutionRegex.exec(commandToProcess)) !== null) {
            const subCommand = inlineMatch[1];
            const result = await this.processSingleCommand(subCommand, { isInteractive: false, suppressOutput: true });
            const output = result.success ? (result.output || '').trim().replace(/\n/g, ' ') : '';
            commandToProcess = commandToProcess.replace(inlineMatch[0], output);
        }
        let inQuote = null; let commentIndex = -1;
        for (let i = 0; i < commandToProcess.length; i++) {
            const char = commandToProcess[i];
            if (inQuote) { if (char === inQuote) { inQuote = null; } }
            else { if (char === '"' || char === "'") { inQuote = char; } else if (char === '#' && (i === 0 || /\s/.test(commandToProcess[i - 1]))) { commentIndex = i; break; } }
        }
        if (commentIndex > -1) { commandToProcess = commandToProcess.substring(0, commentIndex).trim(); }
        if (!commandToProcess) { return ""; }
        if (scriptingContext && scriptingContext.args) {
            const scriptArgs = scriptingContext.args;
            commandToProcess = commandToProcess.replace(/\$@/g, scriptArgs.join(" "));
            commandToProcess = commandToProcess.replace(/\$#/g, scriptArgs.length);
            scriptArgs.forEach((arg, i) => { const regex = new RegExp(`\\$${i + 1}`, "g"); commandToProcess = commandToProcess.replace(regex, arg); });
        }
        commandToProcess = commandToProcess.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)}/g, (match, var1, var2) => { const varName = var1 || var2; return EnvironmentManager.get(varName); });
        const aliasResult = AliasManager.resolveAlias(commandToProcess);
        if (aliasResult.error) { throw new Error(aliasResult.error); }
        return aliasResult.newCommand;
    }

    async _finalizeInteractiveModeUI(originalCommandText) {
        const { TerminalUI, AppLayerManager, HistoryManager } = this.dependencies;
        TerminalUI.clearInput(); TerminalUI.updatePrompt();
        if (!AppLayerManager.isActive()) { TerminalUI.showInputLine(); TerminalUI.setInputState(true); TerminalUI.focusInput(); }
        TerminalUI.scrollOutputToEnd();
        if (!TerminalUI.getIsNavigatingHistory() && originalCommandText.trim()) { HistoryManager.resetIndex(); }
        TerminalUI.setIsNavigatingHistory(false);
    }

    async processSingleCommand(rawCommandText, options = {}) {
        const { isInteractive = true, scriptingContext = null, suppressOutput = false, stdinContent = null } = options;
        const { ModalManager, OutputManager, TerminalUI, AppLayerManager, HistoryManager, Config, ErrorHandler, FileSystemManager, UserManager, StorageManager, GroupManager } = this.dependencies;
        if (this.isInDreamatorium && rawCommandText.trim() === 'exit') { if (typeof this.dreamatoriumExitHandler === 'function') { await this.dreamatoriumExitHandler(); } return ErrorHandler.createSuccess(""); }
        if (ModalManager.isAwaiting()) { await ModalManager.handleTerminalInput(TerminalUI.getCurrentInputValue()); if (isInteractive) await this._finalizeInteractiveModeUI(rawCommandText); return ErrorHandler.createSuccess(""); }
        const cmdToEcho = rawCommandText.trim();
        if (isInteractive && !scriptingContext) { TerminalUI.hideInputLine(); const prompt = TerminalUI.getPromptText(); await OutputManager.appendToOutput(`${prompt}${cmdToEcho}`); }
        if (cmdToEcho === "") { if (isInteractive) await this._finalizeInteractiveModeUI(rawCommandText); return ErrorHandler.createSuccess(""); }
        if (isInteractive) HistoryManager.add(cmdToEcho);
        let finalResult;
        try {
            const commandToExecute = await this._preprocessCommandString(rawCommandText, scriptingContext);
            const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            const jsContext = { current_path: FileSystemManager.getCurrentPath(), user_context: { name: UserManager.getCurrentUser().name }, users: StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {}), user_groups: GroupManager.getGroupsForUser(UserManager.getCurrentUser().name), groups: GroupManager.getAllGroups(), jobs: this.activeJobs, config: { MAX_VFS_SIZE: Config.FILESYSTEM.MAX_VFS_SIZE }, api_key: apiKey };
            const resultJson = OopisOS_Kernel.execute_command(commandToExecute, JSON.stringify(jsContext), stdinContent);
            const result = JSON.parse(resultJson);
            if (result.success) {
                if (result.effect) {
                    const effectResult = await this._handleEffect(result, options);
                    if (effectResult) { finalResult = effectResult; }
                }
                if (!finalResult) { finalResult = ErrorHandler.createSuccess(result.output, { suppressNewline: result.suppress_newline }); }
            } else {
                finalResult = ErrorHandler.createError({ message: result.error || "An unknown Python error occurred." });
            }
        } catch (e) { finalResult = ErrorHandler.createError({ message: e.message || "JavaScript execution error." }); }
        if (!suppressOutput) {
            if (finalResult.success) { if (finalResult.data !== null && finalResult.data !== undefined) { await OutputManager.appendToOutput(finalResult.data, finalResult); } }
            else {
                let errorMessage = "Unknown error";
                if (typeof finalResult.error === 'string') { errorMessage = finalResult.error; }
                else if (finalResult.error && typeof finalResult.error.message === 'string') {
                    errorMessage = finalResult.error.message;
                    if (finalResult.error.suggestion) { errorMessage += `\nSuggestion: ${finalResult.error.suggestion}`; }
                }
                await OutputManager.appendToOutput(errorMessage, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
        }
        if (isInteractive && !scriptingContext) { await this._finalizeInteractiveModeUI(rawCommandText); }
        return finalResult;
    }

    async _handleEffect(result, options) {
        const { FileSystemManager, TerminalUI, SoundManager, SessionManager, AppLayerManager, UserManager, ErrorHandler, Config, OutputManager, PagerManager, Utils } = this.dependencies;
        switch (result.effect) {
            case 'change_directory': FileSystemManager.setCurrentPath(result.path); TerminalUI.updatePrompt(); break;
            case 'clear_screen': OutputManager.clearOutput(); break;
            case 'beep': SoundManager.beep(); break;
            case 'reboot': await OutputManager.appendToOutput("Rebooting..."); setTimeout(() => window.location.reload(), 1000); break;
            case 'full_reset': await SessionManager.performFullReset(); break;
            case 'launch_app':
                const App = window[result.app_name + "Manager"];
                if (App) { const appInstance = new App(); AppLayerManager.show(appInstance, { ...options, dependencies: this.dependencies, ...result.options }); }
                else { console.error(`Attempted to launch unknown app: ${result.app_name}`); }
                break;
            case 'visudo': await this.processSingleCommand(`edit /etc/sudoers`, { ...options, isVisudo: true }); break;
            case 'useradd': await UserManager.registerWithPrompt(result.username, options); break;
            case 'passwd': await UserManager.changePasswordWithPrompt(result.username, options); break;
            case 'removeuser': await UserManager.removeUserWithPrompt(result.username, result.remove_home, options); break;
            case 'page_output': await PagerManager.enter(result.content, { mode: result.mode }); break;
            case 'export_file': case 'backup_data':
                const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = Utils.createElement("a", { href: url, download: result.filename });
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                break;
            case 'upload_files':
                const { files } = result;
                for (const file of files) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const content = event.target.result;
                        const jsContext = { current_path: FileSystemManager.getCurrentPath(), user_context: { name: UserManager.getCurrentUser().name } };
                        const writeResultJson = OopisOS_Kernel.write_uploaded_file(file.name, content, JSON.stringify(jsContext));
                        const writeResult = JSON.parse(writeResultJson);
                        if(writeResult.success) { OutputManager.appendToOutput(`Uploaded '${file.name}' to ${writeResult.path}`); }
                        else { OutputManager.appendToOutput(`Error uploading '${file.name}': ${writeResult.error}`, {typeClass: Config.CSS_CLASSES.ERROR_MSG}); }
                    };
                    reader.readAsText(file);
                }
                break;
            case 'signal_job': // <-- NEW CASE
                const signalResult = this.sendSignalToJob(result.job_id, result.signal);
                if (!signalResult.success) {
                    return ErrorHandler.createError(signalResult.error);
                }
                break;
            case 'login':
                const loginResult = await UserManager.login(result.username, result.password, options);
                if (loginResult.success && loginResult.data?.isLogin) { loginResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${result.username}${Config.MESSAGES.WELCOME_SUFFIX}`; }
                return loginResult;
            case 'logout':
                const logoutResult = await UserManager.logout();
                if (logoutResult.success && logoutResult.data?.isLogout) { logoutResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${logoutResult.data.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`; }
                return logoutResult;
            case 'su':
                const suResult = await UserManager.su(result.username, result.password, options);
                if (suResult.success && !suResult.data?.noAction) { suResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${result.username}${Config.MESSAGES.WELCOME_SUFFIX}`; }
                return suResult;
            case 'display_prose':
                const { header = '', content = '' } = result;
                const finalHtml = DOMPurify.sanitize(marked.parse(content));
                const fullOutput = header ? `${header}${finalHtml}` : finalHtml;
                return ErrorHandler.createSuccess(fullOutput, { asBlock: true, messageType: 'prose-output' });
        }
    }
}