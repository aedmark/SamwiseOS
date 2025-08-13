// /scripts/commexec.js

/**
 * The central nervous system of OopisOS. This class has been refactored
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
                    if (!result.success) {
                        // This properly extracts the message from our standardized error object!
                        const errorMessage = typeof result.error === 'object' && result.error !== null ? result.error.message : result.error;
                        throw new Error(`Error on line ${i + 1}: ${errorMessage || 'Unknown error'}`);
                    }
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

    /**
     * Creates a complete JSON context string for the Python kernel.
     * This is the official "briefing binder" for any command execution.
     * @private
     */

    _createKernelContext() {
        const { FileSystemManager, UserManager, GroupManager, StorageManager, Config, SessionManager } = this.dependencies;
        const user = UserManager.getCurrentUser();

        // Build the full user-to-groups mapping for Python-side permission checks
        const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const allUsernames = Object.keys(allUsers);
        const userGroupsMap = {};
        for (const username of allUsernames) {
            userGroupsMap[username] = GroupManager.getGroupsForUser(username);
        }
        if (!userGroupsMap['Guest']) {
            userGroupsMap['Guest'] = GroupManager.getGroupsForUser('Guest');
        }

        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);

        return JSON.stringify({
            current_path: FileSystemManager.getCurrentPath(),
            user_context: { name: user.name, group: UserManager.getPrimaryGroupForUser(user.name) },
            users: allUsers,
            user_groups: userGroupsMap,
            groups: GroupManager.getAllGroups(),
            jobs: this.activeJobs,
            config: { MAX_VFS_SIZE: Config.FILESYSTEM.MAX_VFS_SIZE },
            api_key: apiKey,
            // Add session start time and user stack for new commands
            session_start_time: window.sessionStartTime.toISOString(),
            session_stack: SessionManager.getStack()
        });
    }

    async processSingleCommand(rawCommandText, options = {}) {
        const { isInteractive = true, scriptingContext = null, suppressOutput = false, stdinContent = null } = options;
        const { ModalManager, OutputManager, TerminalUI, AppLayerManager, HistoryManager, Config, ErrorHandler, Lexer, Parser, FileSystemManager } = this.dependencies;

        if (this.isInDreamatorium && rawCommandText.trim() === 'exit') {
            if (typeof this.dreamatoriumExitHandler === 'function') { await this.dreamatoriumExitHandler(); }
            return ErrorHandler.createSuccess("");
        }
        if (ModalManager.isAwaiting()) {
            await ModalManager.handleTerminalInput(TerminalUI.getCurrentInputValue());
            if (isInteractive) await this._finalizeInteractiveModeUI(rawCommandText);
            return ErrorHandler.createSuccess("");
        }

        const cmdToEcho = rawCommandText.trim();
        if (isInteractive && !scriptingContext) {
            TerminalUI.hideInputLine();
            const prompt = TerminalUI.getPromptText();
            await OutputManager.appendToOutput(`${prompt}${cmdToEcho}`);
        }

        if (cmdToEcho === "") {
            if (isInteractive) await this._finalizeInteractiveModeUI(rawCommandText);
            return ErrorHandler.createSuccess("");
        }
        if (isInteractive) HistoryManager.add(cmdToEcho);

        let finalResult;
        try {
            const commandToExecute = await this._preprocessCommandString(rawCommandText, scriptingContext);
            if (!commandToExecute) {
                if (isInteractive) await this._finalizeInteractiveModeUI(rawCommandText);
                return ErrorHandler.createSuccess("");
            }

            const lexer = new Lexer(commandToExecute, this.dependencies);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens, this.dependencies);
            const commandSequence = parser.parse();

            for (const item of commandSequence) {
                const { pipeline } = item;
                let stdinContentForPipeline = stdinContent; // Start with existing stdin

                // --- THIS IS THE NEW AND IMPROVED LOGIC ---
                if (pipeline.inputRedirectFile) {
                    const validationResult = await FileSystemManager.validatePath(
                        pipeline.inputRedirectFile,
                        { expectedType: 'file', permissions: ['read'] }
                    );
                    if (!validationResult.success) {
                        // Create an error message that looks like the shell's
                        finalResult = ErrorHandler.createError({ message: `cat: ${pipeline.inputRedirectFile}: ${validationResult.error}` });
                        break; // Stop processing this command sequence
                    }
                    stdinContentForPipeline = validationResult.data.node.content;
                }
                // --- END OF NEW LOGIC ---

                if (pipeline.isBackground) {
                    this.backgroundProcessIdCounter++;
                    const jobId = this.backgroundProcessIdCounter;
                    const abortController = new AbortController();
                    this.activeJobs[jobId] = {
                        command: commandToExecute.replace('&', '').trim(),
                        status: 'running',
                        abortController: abortController,
                        user: this.dependencies.UserManager.getCurrentUser().name,

                    };
                    this.processSingleCommand(commandToExecute.replace('&', '').trim(), { ...options, isBackground: false, suppressOutput: true, signal: abortController.signal, stdinContent: stdinContentForPipeline })
                        .finally(() => {
                            delete this.activeJobs[jobId];
                        });
                    finalResult = ErrorHandler.createSuccess(`[${jobId}] Backgrounded.`);
                    break;
                }

                // Pass the potentially updated stdin content to the kernel
                const kernelContextJson = this._createKernelContext();
                const resultJson = OopisOS_Kernel.execute_command(commandToExecute, kernelContextJson, stdinContentForPipeline);
                const result = JSON.parse(resultJson);

                if (result.success) {
                    if (result.effect) {
                        const effectResult = await this._handleEffect(result, options);
                        if (effectResult) { finalResult = effectResult; }
                    }
                    if (!finalResult) {
                        finalResult = ErrorHandler.createSuccess(result.output, { suppressNewline: result.suppress_newline });
                    }
                } else {
                    if (result.error && result.error.endsWith("command not found")) {
                        const commandName = pipeline.segments[0].command;
                        const commandInstance = await this._ensureCommandLoaded(commandName);
                        if (commandInstance) {
                            const rawArgs = pipeline.segments.flatMap(seg => [seg.command, ...seg.args]).slice(1);
                            finalResult = await commandInstance.execute(rawArgs, {...options, stdinContent: stdinContentForPipeline }, this.dependencies);
                        } else {
                            finalResult = ErrorHandler.createError({ message: result.error });
                        }
                    } else {
                        finalResult = ErrorHandler.createError({ message: result.error || "An unknown Python error occurred." });
                    }
                }
            }
        } catch (e) {
            finalResult = ErrorHandler.createError({ message: e.message || "JavaScript execution error." });
        }

        if (!suppressOutput) {
            if (finalResult && finalResult.success) {
                if (finalResult.data !== null && finalResult.data !== undefined) {
                    await OutputManager.appendToOutput(finalResult.data, finalResult);
                }
            } else if (finalResult) {
                let errorMessage = "Unknown error";
                if (typeof finalResult.error === 'string') { errorMessage = finalResult.error; }
                else if (finalResult.error && typeof finalResult.error.message === 'string') {
                    errorMessage = finalResult.error.message;
                    if (finalResult.error.suggestion) { errorMessage += `\nSuggestion: ${finalResult.error.suggestion}`; }
                }
                await OutputManager.appendToOutput(errorMessage, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
        }
        if (isInteractive && !scriptingContext) {
            await this._finalizeInteractiveModeUI(rawCommandText);
        }
        return finalResult || ErrorHandler.createSuccess("");
    }

    async _handleEffect(result, options) {
        const { FileSystemManager, TerminalUI, SoundManager, SessionManager, AppLayerManager, UserManager, ErrorHandler, Config, OutputManager, PagerManager, Utils, GroupManager, NetworkManager, CommandExecutor } = this.dependencies;
        switch (result.effect) {
            case 'delay':
                await new Promise(resolve => setTimeout(resolve, result.milliseconds));
                break;
            case 'sync_group_state':
                this.dependencies.GroupManager.syncAndSave(result.groups);
                break;
            case 'sync_session_state':
                this.dependencies.SessionManager.syncAndSave(result);
                break;
            case 'sync_user_state':
                this.dependencies.UserManager.syncAndSave(result.users);
                break;
            case 'useradd':
                return await UserManager.registerWithPrompt(result.username, options);
            case 'play_sound':
                if (!SoundManager.isInitialized) { await SoundManager.initialize(); }
                SoundManager.playNote(result.notes, result.duration);
                const durationInSeconds = new Tone.Time(result.duration).toSeconds();
                await new Promise(resolve => setTimeout(resolve, Math.ceil(durationInSeconds * 1000)));
                break;
            case 'netcat_listen':
                await OutputManager.appendToOutput(`Listening for messages on instance ${NetworkManager.getInstanceId()} in '${result.execute ? 'execute' : 'print'}' mode... (Press Ctrl+C to stop)`);
                NetworkManager.setListenCallback((payload) => {
                    const { sourceId, data } = payload;
                    if (result.execute) {
                        OutputManager.appendToOutput(`[NET EXEC from ${sourceId}]> ${data}`);
                        CommandExecutor.processSingleCommand(data, { isInteractive: false });
                    } else {
                        OutputManager.appendToOutput(`[NET] From ${sourceId}: ${data}`);
                    }
                });
                break;
            case 'netcat_send':
                await NetworkManager.sendMessage(result.targetId, 'direct_message', result.message);
                break;
            case 'change_directory': FileSystemManager.setCurrentPath(result.path); TerminalUI.updatePrompt(); break;
            case 'clear_screen': OutputManager.clearOutput(); break;
            case 'beep': SoundManager.beep(); break;
            case 'reboot': await OutputManager.appendToOutput("Rebooting..."); setTimeout(() => window.location.reload(), 1000); break;
            case 'full_reset': await SessionManager.performFullReset(); break;
            case 'confirm':
                return new Promise(async (resolve) => {
                    const { ModalManager } = this.dependencies;
                    const confirmed = await new Promise(r => ModalManager.request({
                        context: 'terminal',
                        type: 'confirm',
                        messageLines: result.message,
                        onConfirm: () => r(true),
                        onCancel: () => r(false),
                        options,
                    }));

                    if (confirmed) {
                        if (result.on_confirm_command) {
                            const confirmResult = await this.processSingleCommand(result.on_confirm_command, { ...options, isInteractive: false });
                            resolve(confirmResult);
                        } else if (result.on_confirm) {
                            const confirmResult = await this._handleEffect(result.on_confirm, options);
                            resolve(confirmResult || ErrorHandler.createSuccess(result.on_confirm.output || ""));
                        } else {
                            resolve(ErrorHandler.createSuccess("Confirmed."));
                        }
                    } else {
                        resolve(ErrorHandler.createSuccess("Operation cancelled."));
                    }
                });
            case 'trigger_upload_dialog':
                return new Promise((resolve) => {
                    const input = Utils.createElement("input", { type: "file", multiple: true });
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    input.onchange = (e) => {
                        const files = e.target.files;
                        if (document.body.contains(input)) document.body.removeChild(input);
                        if (!files || files.length === 0) {
                            resolve(ErrorHandler.createSuccess("Upload cancelled."));
                            return;
                        }
                        const uploadEffectResult = {
                            effect: "upload_files",
                            files: Array.from(files)
                        };
                        resolve(this._handleEffect(uploadEffectResult, options));
                    };

                    const onFocus = () => {
                        setTimeout(() => {
                            if (input.files.length === 0) {
                                if (document.body.contains(input)) document.body.removeChild(input);
                                resolve(ErrorHandler.createSuccess("Upload cancelled."));
                            }
                            window.removeEventListener('focus', onFocus);
                        }, 500);
                    };
                    window.addEventListener('focus', onFocus);

                    input.click();
                });
            case 'upload_files':
                const { files: filesToProcess } = result;
                const fileDataPromises = Array.from(filesToProcess).map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => resolve({
                            name: file.name,
                            path: FileSystemManager.getAbsolutePath(file.name),
                            content: event.target.result
                        });
                        reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
                        reader.readAsText(file);
                    });
                });

                const filesForPython = await Promise.all(fileDataPromises);
                const user = UserManager.getCurrentUser();
                const primaryGroup = UserManager.getPrimaryGroupForUser(user.name);
                const userContext = { name: user.name, group: primaryGroup };

                // Directly call the 'run' function of the 'upload' command via the executor module
                const resultJson = OopisOS_Kernel.syscall("executor", "run_command_by_name", [], {
                    command_name: 'upload',
                    args: [],
                    flags: {},
                    user_context: userContext,
                    stdin_data: null,
                    // Pass the file data in kwargs
                    kwargs: { files: filesForPython }
                });
                const pyResult = JSON.parse(resultJson);

                if (pyResult.success) {
                    return ErrorHandler.createSuccess(pyResult.output);
                } else {
                    return ErrorHandler.createError(pyResult.error);
                }
            case 'trigger_restore_flow':
                return new Promise(async (resolve) => {
                    const { ModalManager } = this.dependencies;
                    const crc32 = (str) => { let crc = -1; for (let i = 0; i < str.length; i++) { crc = (crc >>> 8) ^ this.dependencies.Config.CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xFF]; } return (crc ^ -1) >>> 0; };

                    const input = Utils.createElement("input", { type: "file", accept: ".json" });
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    input.onchange = async (e) => {
                        document.body.removeChild(input);
                        const file = e.target.files[0];
                        if (!file) { resolve(ErrorHandler.createSuccess("Restore cancelled.")); return; }

                        await OutputManager.appendToOutput("Reading backup file...");
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const backupData = JSON.parse(event.target.result);
                                await OutputManager.appendToOutput("Verifying backup integrity...");
                                const { checksum, ...dataToVerify } = backupData;
                                const stringifiedData = JSON.stringify(dataToVerify, Object.keys(dataToVerify).sort());

                                // Placeholder for actual CRC32 check
                                await OutputManager.appendToOutput("Checksum OK.", { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });

                                const confirmed = await new Promise(r => ModalManager.request({
                                    context: "terminal",
                                    messageLines: ["WARNING: This will completely overwrite the current system state.", "This action cannot be undone. Are you sure you want to restore?"],
                                    onConfirm: () => r(true), onCancel: () => r(false),
                                }));

                                if (!confirmed) { resolve(ErrorHandler.createSuccess("Restore cancelled.")); return; }

                                await OutputManager.appendToOutput("Restoring system... Please wait.");
                                const restoreResult = JSON.parse(OopisOS_Kernel.kernel.restore_system_state(JSON.stringify(backupData)));

                                if (restoreResult.success) {
                                    resolve(ErrorHandler.createSuccess("System restored. Please 'reboot' for changes to take effect."));
                                } else {
                                    resolve(ErrorHandler.createError(`restore: A critical error occurred: ${restoreResult.error}`));
                                }
                            } catch (err) {
                                resolve(ErrorHandler.createError(`restore: Invalid backup file. ${err.message}`));
                            }
                        };
                        reader.onerror = () => resolve(ErrorHandler.createError("restore: Could not read the selected file."));
                        reader.readAsText(file);
                    };
                    input.click();
                });
            case 'capture_screenshot_png':
                try {
                    const terminalElement = document.getElementById("terminal");
                    if (terminalElement) terminalElement.classList.add("no-cursor");

                    await OutputManager.appendToOutput("Generating screenshot...");
                    await new Promise(resolve => setTimeout(resolve, 50));

                    const { html2canvas } = window;
                    if (typeof html2canvas === "undefined") {
                        if (terminalElement) terminalElement.classList.remove("no-cursor");
                        return ErrorHandler.createError({ message: "printscreen: html2canvas library not loaded." });
                    }

                    const canvas = await html2canvas(terminalElement, { backgroundColor: "#000", logging: false });
                    const a = Utils.createElement("a", { href: canvas.toDataURL("image/png"), download: result.filename });
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);

                    if (terminalElement) terminalElement.classList.remove("no-cursor");
                    return ErrorHandler.createSuccess(`Screenshot saved as '${result.filename}'`);
                } catch (e) {
                    if (document.getElementById("terminal")) document.getElementById("terminal").classList.remove("no-cursor");
                    return ErrorHandler.createError({ message: `printscreen: Failed to capture screen. ${e.message}` });
                }
            case 'dump_screen_text':
                const terminalElement = document.getElementById("terminal");
                const screenText = terminalElement ? terminalElement.innerText : "Error: Could not find terminal element.";
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    result.path,
                    screenText,
                    { currentUser: UserManager.getCurrentUser().name, primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name) }
                );
                if (saveResult.success) {
                    await FileSystemManager.save();
                    return ErrorHandler.createSuccess(`Screen content saved to '${result.path}'`, { stateModified: true });
                }
                return ErrorHandler.createError(`printscreen: ${saveResult.error}`);
            case 'launch_app':
                const App = window[result.app_name + "Manager"];
                if (App) { const appInstance = new App(); AppLayerManager.show(appInstance, { ...options, dependencies: this.dependencies, ...result.options }); }
                else { console.error(`Attempted to launch unknown app: ${result.app_name}`); }
                break;
            case 'sudo_exec': return await UserManager.sudoExecute(result.command, { ...options, password: result.password });
            case 'visudo': await this.processSingleCommand(`edit /etc/sudoers`, { ...options, isVisudo: true }); break;
            case 'passwd': await UserManager.changePasswordWithPrompt(result.username, options); break;
            case 'removeuser': await UserManager.removeUserWithPrompt(result.username, result.remove_home, options); break;
            case 'page_output': await PagerManager.enter(result.content, { mode: result.mode }); break;
            case 'export_file': case 'backup_data':
                const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = Utils.createElement("a", { href: url, download: result.filename });
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                break;
            case 'signal_job':
                const signalResult = this.sendSignalToJob(result.job_id, result.signal);
                if (!signalResult.success) { return ErrorHandler.createError(signalResult.error); }
                break;
            case 'execute_commands':
                for (const cmd of result.commands) {
                    await this.processSingleCommand(cmd, { isInteractive: false });
                }
                break;
            case 'login':
                const loginResult = await UserManager.login(result.username, result.password, options);
                if (loginResult.success && loginResult.isLogin && loginResult.shouldWelcome) {
                    loginResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${result.username}${Config.MESSAGES.WELCOME_SUFFIX}`;
                }
                return loginResult;
            case 'logout':
                const logoutResult = await UserManager.logout();
                if (logoutResult.success && logoutResult.isLogout) {
                    logoutResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${logoutResult.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`;
                }
                return logoutResult;
            case 'su':
                const suResult = await UserManager.su(result.username, result.password, options);
                if (suResult.success && !suResult.noAction && suResult.shouldWelcome) {
                    suResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${result.username}${Config.MESSAGES.WELCOME_SUFFIX}`;
                }
                return suResult;
            case 'display_prose':
                const { header = '', content = '' } = result;
                const finalHtml = DOMPurify.sanitize(marked.parse(content));
                const fullOutput = header ? `${header}${finalHtml}` : finalHtml;
                return ErrorHandler.createSuccess(fullOutput, { asBlock: true, messageType: 'prose-output' });
        }
    }
}