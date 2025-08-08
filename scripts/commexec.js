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
        /**
         * A counter for assigning unique IDs to background processes.
         * @type {number}
         */
        this.backgroundProcessIdCounter = 0;
        /**
         * A map of active background jobs, indexed by their PID.
         * @type {object}
         */
        this.activeJobs = {};
        /**
         * A set to keep track of dynamically loaded command scripts to avoid
         * redundant fetches.
         * @type {Set<string>}
         */
        this.loadedScripts = new Set();
        /**
         * The dependency injection container.
         * @type {object}
         */
        this.dependencies = {};
        /**
         * A flag to indicate if the current session is inside the Dreamatorium.
         * What happens in the Dreamatorium stays in the Dreamatorium.
         * @type {boolean}
         */
        this.isInDreamatorium = false;
    }

    /**
     * Sets the dependency injection container for the executor.
     * @param {object} dependencies - The dependencies to be injected.
     */
    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    // _loadScript and _ensureCommandLoaded are kept to support any JS commands
    // that have not yet been migrated to Python.
    _loadScript(scriptPath) {
        if (this.loadedScripts.has(scriptPath)) {
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `./scripts/${scriptPath}`;
            script.onload = () => {
                this.loadedScripts.add(scriptPath);
                resolve(true);
            };
            script.onerror = () => {
                reject(new Error(`Failed to fetch script: ${scriptPath}`));
            };
            document.head.appendChild(script);
        });
    }

    async _ensureCommandLoaded(commandName) {
        const { Config, OutputManager, CommandRegistry, FileSystemManager } = this.dependencies;
        if (!commandName || typeof commandName !== "string") return null;

        const existingCommand = CommandRegistry.getCommands()[commandName];
        if (existingCommand) {
            return existingCommand;
        }

        if (Config.COMMANDS_MANIFEST.includes(commandName)) {
            const commandScriptPath = `commands/${commandName}.js`;
            try {
                await this._loadScript(commandScriptPath);
                const commandInstance = CommandRegistry.getCommands()[commandName];

                if (!commandInstance) {
                    await OutputManager.appendToOutput(
                        `Error: Script loaded but command '${commandName}' failed to register itself.`,
                        { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                    );
                    return null;
                }

                const definition = commandInstance.definition;
                if (definition.dependencies && Array.isArray(definition.dependencies)) {
                    for (const dep of definition.dependencies) {
                        await this._loadScript(dep);
                    }
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
                            await OutputManager.appendToOutput(
                                `Error: Installed package '${commandName}' was executed but failed to register itself. The package may be corrupt.`,
                                { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                            );
                            return null;
                        }
                        return commandInstance;
                    } catch (e) {
                        await OutputManager.appendToOutput(
                            `Error: Failed to execute package '${commandName}' from '${vfsPath}'. ${e.message}`,
                            { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                        );
                        return null;
                    }
                } else {
                    await OutputManager.appendToOutput(
                        `Error: Command '${commandName}' could not be loaded. ${error.message}`,
                        { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                    );
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Retrieves a list of all active background jobs.
     * @returns {object} A map of active jobs.
     */
    getActiveJobs() {
        return this.activeJobs;
    }

    /**
     * Sends a signal to a running background job.
     * @param {number} jobId - The ID of the job to signal.
     * @param {string} signal - The signal to send ('KILL', 'TERM', 'STOP', 'CONT').
     * @returns {object} A result object indicating success or failure.
     */
    sendSignalToJob(jobId, signal) {
        const { ErrorHandler } = this.dependencies;
        const job = this.activeJobs[jobId];
        if (!job) {
            return ErrorHandler.createError(`Job ${jobId} not found.`);
        }

        switch (signal.toUpperCase()) {
            case 'KILL':
            case 'TERM':
                if (job.abortController) {
                    job.abortController.abort("Killed by user command.");
                    delete this.activeJobs[jobId];
                    this.dependencies.MessageBusManager.unregisterJob(jobId);
                }
                break;
            case 'STOP':
                job.status = 'paused';
                break;
            case 'CONT':
                job.status = 'running';
                break;
            default:
                return ErrorHandler.createError(`Invalid signal '${signal}'.`);
        }

        return ErrorHandler.createSuccess(`Signal ${signal} sent to job ${jobId}.`);
    }


    /**
     * Executes a series of commands from a script file line by line.
     * @param {string[]} lines - An array of command strings from the script.
     * @param {object} [options={}] - Options for execution.
     * @returns {Promise<object>} A promise that resolves to the final result of the script.
     */
    async executeScript(lines, options = {}) {
        const { ErrorHandler, EnvironmentManager, Config } = this.dependencies;

        EnvironmentManager.push();

        const scriptingContext = {
            isScripting: true,
            lines: lines,
            currentLineIndex: -1,
            args: options.args || [],
        };

        let stepCounter = 0;
        const MAX_STEPS = Config.FILESYSTEM.MAX_SCRIPT_STEPS || 10000;

        try {
            for (let i = 0; i < lines.length; i++) {
                stepCounter++;
                if (stepCounter > MAX_STEPS) {
                    throw new Error(`Maximum script execution steps (${MAX_STEPS}) exceeded.`);
                }
                scriptingContext.currentLineIndex = i;
                const line = lines[i].trim();
                if (line && !line.startsWith("#")) {
                    const result = await this.processSingleCommand(line, {
                        ...options,
                        scriptingContext,
                    });
                    i = scriptingContext.currentLineIndex;
                    if (!result.success) {
                        throw new Error(`Error on line ${i + 1}: ${result.error || 'Unknown error'}`);
                    }
                }
            }
        } finally {
            EnvironmentManager.pop();
        }

        return ErrorHandler.createSuccess("Script finished successfully.");
    }

    /**
     * Expands a command string using brace expansion.
     * @private
     * @param {string} commandString - The command string to expand.
     * @returns {string} The expanded command string.
     */
    _expandBraces(commandString) {
        const braceExpansionRegex = /(\S*?)\{([^}]+)\}(\S*)/g;

        const expander = (match, prefix, content, suffix) => {
            if (content.includes('..')) { // Handle sequence expansion like {1..5} or {a..z}
                const [start, end] = content.split('..');
                const startNum = parseInt(start, 10);
                const endNum = parseInt(end, 10);

                if (!isNaN(startNum) && !isNaN(endNum)) { // Numeric sequence
                    const result = [];
                    const step = startNum <= endNum ? 1 : -1;
                    for (let i = startNum; step > 0 ? i <= endNum : i >= endNum; i += step) {
                        result.push(`${prefix}${i}${suffix}`);
                    }
                    return result.join(' ');
                } else if (start.length === 1 && end.length === 1) { // Character sequence
                    const startCode = start.charCodeAt(0);
                    const endCode = end.charCodeAt(0);
                    const result = [];
                    const step = startCode <= endCode ? 1 : -1;
                    for (let i = startCode; step > 0 ? i <= endCode : i >= endCode; i += step) {
                        result.push(`${prefix}${String.fromCharCode(i)}${suffix}`);
                    }
                    return result.join(' ');
                }
            } else if (content.includes(',')) { // Handle comma expansion like {a,b,c}
                return content.split(',')
                    .map(part => `${prefix}${part}${suffix}`)
                    .join(' ');
            }
            return match;
        };

        let expandedString = commandString;
        let previousString;
        do {
            previousString = expandedString;
            expandedString = expandedString.replace(braceExpansionRegex, expander);
        } while (expandedString !== previousString);

        return expandedString;
    }

    /**
     * Pre-processes the command string before parsing.
     * This handles brace expansion, variable and command substitution, and comments.
     * @private
     * @param {string} rawCommandText - The raw command string from user input or a script.
     * @param {object} [scriptingContext=null] - Optional context for script execution.
     * @returns {Promise<string>} A promise that resolves to the pre-processed command string.
     */
    async _preprocessCommandString(rawCommandText, scriptingContext = null) {
        const { EnvironmentManager, AliasManager } = this.dependencies;
        let commandToProcess = rawCommandText.trim();

        // Apply brace expansion before other processing
        commandToProcess = this._expandBraces(commandToProcess);

        const assignmentSubstitutionRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)=\$\(([^)]+)\)$/;
        const assignmentMatch = commandToProcess.match(assignmentSubstitutionRegex);

        if (assignmentMatch) {
            const varName = assignmentMatch[1];
            const subCommand = assignmentMatch[2];
            const result = await this.processSingleCommand(subCommand, { isInteractive: false, suppressOutput: true });
            const output = result.success ? (result.output || '').trim().replace(/\n/g, ' ') : '';
            EnvironmentManager.set(varName, output);
            return "";
        }

        const commandSubstitutionRegex = /\$\(([^)]+)\)/g;
        let inlineMatch;
        while ((inlineMatch = commandSubstitutionRegex.exec(commandToProcess)) !== null) {
            const subCommand = inlineMatch[1];
            const result = await this.processSingleCommand(subCommand, { isInteractive: false, suppressOutput: true });
            const output = result.success ? (result.output || '').trim().replace(/\n/g, ' ') : '';
            commandToProcess = commandToProcess.replace(inlineMatch[0], output);
        }

        let inQuote = null;
        let commentIndex = -1;

        for (let i = 0; i < commandToProcess.length; i++) {
            const char = commandToProcess[i];

            if (inQuote) {
                if (char === inQuote) {
                    inQuote = null;
                }
            } else {
                if (char === '"' || char === "'") {
                    inQuote = char;
                } else if (char === '#' && (i === 0 || /\s/.test(commandToProcess[i-1]))) {
                    commentIndex = i;
                    break;
                }
            }
        }

        if (commentIndex > -1) {
            commandToProcess = commandToProcess.substring(0, commentIndex).trim();
        }

        if (!commandToProcess) {
            return "";
        }

        if (scriptingContext && scriptingContext.args) {
            const scriptArgs = scriptingContext.args;
            commandToProcess = commandToProcess.replace(/\$@/g, scriptArgs.join(" "));
            commandToProcess = commandToProcess.replace(/\$#/g, scriptArgs.length);
            scriptArgs.forEach((arg, i) => {
                const regex = new RegExp(`\\$${i + 1}`, "g");
                commandToProcess = commandToProcess.replace(regex, arg);
            });
        }

        commandToProcess = commandToProcess.replace(
            /\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)}/g,
            (match, var1, var2) => {
                const varName = var1 || var2;
                return EnvironmentManager.get(varName);
            }
        );

        const aliasResult = AliasManager.resolveAlias(commandToProcess);
        if (aliasResult.error) {
            throw new Error(aliasResult.error);
        }

        return aliasResult.newCommand;
    }

    /**
     * Handles final UI cleanup after a command is executed in interactive mode.
     * @private
     * @param {string} originalCommandText - The original command text.
     * @returns {Promise<void>}
     */
    async _finalizeInteractiveModeUI(originalCommandText) {
        const { TerminalUI, AppLayerManager, HistoryManager } = this.dependencies;
        TerminalUI.clearInput();
        TerminalUI.updatePrompt();
        if (!AppLayerManager.isActive()) {
            TerminalUI.showInputLine();
            TerminalUI.setInputState(true);
            TerminalUI.focusInput();
        }
        TerminalUI.scrollOutputToEnd();

        if (
            !TerminalUI.getIsNavigatingHistory() &&
            originalCommandText.trim()
        ) {
            HistoryManager.resetIndex();
        }
        TerminalUI.setIsNavigatingHistory(false);
    }

    /**
     * The main entry point for executing a single command string.
     * [REFACTORED] This function now delegates all parsing and execution to the Python kernel.
     * @param {string} rawCommandText - The raw command string to execute.
     * @param {object} [options={}] - Options for the command execution.
     * @returns {Promise<object>} A promise that resolves to a result object.
     */
    async processSingleCommand(rawCommandText, options = {}) {
        const { isInteractive = true, scriptingContext = null, suppressOutput = false, stdinContent = null } = options;
        const {
            ModalManager, OutputManager, TerminalUI, AppLayerManager, HistoryManager,
            Config, ErrorHandler, FileSystemManager, UserManager, StorageManager,
            GroupManager, SoundManager, SessionManager
        } = this.dependencies;

        if (this.isInDreamatorium && rawCommandText.trim() === 'exit') {
            if (typeof this.dreamatoriumExitHandler === 'function') {
                await this.dreamatoriumExitHandler();
            }
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
            // 1. Preprocess the string in JS (variable expansion, aliases, etc.)
            const commandToExecute = await this._preprocessCommandString(rawCommandText, scriptingContext);

            // 2. Gather all necessary context for the Python kernel
            const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            const jsContext = {
                current_path: FileSystemManager.getCurrentPath(),
                user_context: { name: UserManager.getCurrentUser().name },
                users: StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {}),
                user_groups: GroupManager.getGroupsForUser(UserManager.getCurrentUser().name),
                groups: GroupManager.getAllGroups(),
                jobs: this.activeJobs,
                config: { MAX_VFS_SIZE: Config.FILESYSTEM.MAX_VFS_SIZE },
                api_key: apiKey
            };

            // 3. Call the Python kernel's unified execute method
            const resultJson = OopisOS_Kernel.execute_command(
                commandToExecute,
                JSON.stringify(jsContext),
                stdinContent
            );

            const result = JSON.parse(resultJson);

            // 4. Handle the result and any "effects"
            if (result.success) {
                // This is where we handle UI changes requested by Python
                if (result.effect) {
                    await this._handleEffect(result, options);
                }

                // Special case for JS-only commands that need to be piped from Python
                if (result.effect === 'fallback_to_js') {
                    await OutputManager.appendToOutput(`Note: ${result.reason}`, { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                    finalResult = await this._executeLegacyJsCommand(commandToExecute, options);
                } else {
                    finalResult = ErrorHandler.createSuccess(result.output, {
                        suppressNewline: result.suppress_newline
                    });
                }
            } else {
                finalResult = ErrorHandler.createError({ message: result.error || "An unknown Python error occurred." });
            }

        } catch (e) {
            finalResult = ErrorHandler.createError({ message: e.message || "JavaScript execution error." });
        }

        // Display final output or error
        if (!suppressOutput) {
            if (finalResult.success) {
                if (finalResult.data !== null && finalResult.data !== undefined) {
                    await OutputManager.appendToOutput(finalResult.data, finalResult);
                }
            } else {
                let errorMessage = "Unknown error";
                if (typeof finalResult.error === 'string') {
                    errorMessage = finalResult.error;
                } else if (finalResult.error && typeof finalResult.error.message === 'string') {
                    errorMessage = finalResult.error.message;
                    if (finalResult.error.suggestion) {
                        errorMessage += `\nSuggestion: ${finalResult.error.suggestion}`;
                    }
                }
                await OutputManager.appendToOutput(errorMessage, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
        }

        if (isInteractive && !scriptingContext) {
            await this._finalizeInteractiveModeUI(rawCommandText);
        }

        return finalResult;
    }

    /**
     * New method to handle effects returned from the Python kernel.
     * This keeps the main execution logic clean.
     * @param {object} result - The result object from Python.
     * @param {object} options - The original command options.
     */
    async _handleEffect(result, options) {
        const { FileSystemManager, TerminalUI, SoundManager, SessionManager, AppLayerManager, UserManager, ErrorHandler, Config, OutputManager } = this.dependencies;

        switch (result.effect) {
            case 'change_directory':
                FileSystemManager.setCurrentPath(result.path);
                TerminalUI.updatePrompt();
                break;
            case 'clear_screen':
                OutputManager.clearOutput();
                break;
            case 'beep':
                SoundManager.beep();
                break;
            case 'reboot':
                await OutputManager.appendToOutput("Rebooting...");
                setTimeout(() => window.location.reload(), 1000);
                break;
            case 'full_reset':
                await SessionManager.performFullReset();
                break;
            case 'launch_app':
                const App = window[result.app_name + "Manager"];
                if (App) {
                    // This creates a new instance of the app manager (e.g., new EditorManager())
                    const appInstance = new App();
                    // Pass dependencies and any python-provided options to the app's enter method
                    AppLayerManager.show(appInstance, { ...options, dependencies: this.dependencies, ...result.options });
                } else {
                    console.error(`Attempted to launch unknown app: ${result.app_name}`);
                }
                break;
            case 'visudo':
                await this.processSingleCommand(`edit /etc/sudoers`, { ...options, isVisudo: true });
                break;
            case 'useradd':
                await UserManager.registerWithPrompt(result.username, options);
                break;
            case 'passwd':
                await UserManager.changePasswordWithPrompt(result.username, options);
                break;
            case 'removeuser':
                await UserManager.removeUserWithPrompt(result.username, result.remove_home, options);
                break;
            case 'login':
                const loginResult = await UserManager.login(result.username, result.password, options);
                if (loginResult.success && loginResult.data?.isLogin) {
                    // Overwrite the output with a welcome message on successful login
                    loginResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${result.username}${Config.MESSAGES.WELCOME_SUFFIX}`;
                }
                return loginResult;
            case 'logout':
                const logoutResult = await UserManager.logout();
                if (logoutResult.success && logoutResult.data?.isLogout) {
                    logoutResult.data = `${Config.MESSAGES.WELCOME_PREFIX} ${logoutResult.data.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`;
                }
                return logoutResult;
            case 'su':
                const suResult = await UserManager.su(result.username, result.password, options);
                if (suResult.success && !suResult.data?.noAction) {
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

    /**
     * Executes a legacy JavaScript command. This is a temporary measure during migration.
     * It uses the old Lexer/Parser to run JS commands that Python has flagged for fallback.
     * @param {string} commandString - The command to execute.
     * @param {object} options - The execution options.
     * @returns {Promise<object>} The result of the command execution.
     */
    async _executeLegacyJsCommand(commandString, options) {
        const { Lexer, Parser, ErrorHandler, OutputManager, Config } = this.dependencies;

        // This re-introduces the old parsing logic, but ONLY for specific JS commands.
        try {
            const commandSequence = new Parser(new Lexer(commandString, this.dependencies).tokenize(), this.dependencies).parse();
            const { pipeline } = commandSequence[0];
            const segment = pipeline.segments[0];

            const cmdInstance = await this._ensureCommandLoaded(segment.command.toLowerCase());
            if (!cmdInstance) {
                return ErrorHandler.createError({ message: `${segment.command}: command not found` });
            }
            if (cmdInstance instanceof Command) {
                return await cmdInstance.execute(segment.args, {
                    ...options,
                    stdinContent: options.stdinContent,
                }, this.dependencies);
            }
        } catch (e) {
            await OutputManager.appendToOutput(e.message || "JS Command parse error.", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return ErrorHandler.createError({ message: e.message || "JS Command parse error." });
        }
    }
}