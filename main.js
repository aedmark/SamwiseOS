// gemini/main.js

// This global variable will be our session's birth certificate!
window.sessionStartTime = new Date();

// --- Job Management Globals ---
let backgroundProcessIdCounter = 0;
const activeJobs = {};

function startOnboardingProcess(dependencies) {
    const { AppLayerManager, OutputManager, TerminalUI } = dependencies;
    OutputManager.clearOutput();
    TerminalUI.hideInputLine();

    // Launch the onboarding app!
    const OnboardingApp = window.OnboardingManager;
    if (OnboardingApp) {
        const appInstance = new OnboardingApp();
        AppLayerManager.show(appInstance, { dependencies });
    } else {
        console.error("OnboardingManager app not found!");
        OutputManager.appendToOutput("CRITICAL ERROR: Onboarding process could not be started.");
    }
}

// --- Asynchronous Python Command Execution ---
async function executePythonCommand(rawCommandText, options = {}) {
    const { isInteractive = true, scriptingContext = null, stdinContent = null, asUser = null } = options;
    const { ModalManager, OutputManager, TerminalUI, AppLayerManager, HistoryManager, Config, ErrorHandler } = dependencies;

    // Handle interactive session UI updates
    if (isInteractive && !scriptingContext) {
        TerminalUI.hideInputLine();
        const prompt = TerminalUI.getPromptText();
        await OutputManager.appendToOutput(`${prompt}${rawCommandText.trim()}`);
        if (!options.isSudoContinuation) { // Don't add the sudo prompt itself to history
            await HistoryManager.add(rawCommandText.trim());
        }
    }

    if (rawCommandText.trim() === "") {
        if (isInteractive) await finalizeInteractiveModeUI(rawCommandText);
        return { success: true, output: "" };
    }

    let result;
    try {
        const kernelContextJson = await createKernelContext({ asUser });
        const jsonResult = await OopisOS_Kernel.execute_command(rawCommandText, kernelContextJson, stdinContent);
        const pyResult = JSON.parse(jsonResult);

        if (pyResult.success) {
            if (Array.isArray(pyResult.effects)) {
                // Multiple effects returned (e.g., from semicolon-separated commands). Run sequentially.
                for (const eff of pyResult.effects) {
                    await handleEffect(eff, options);
                }
                result = { success: true };
            } else if (pyResult.effect) {
                // Single effect
                result = await handleEffect(pyResult, options);
            } else if (pyResult.output) {
                // Handle direct output
                await OutputManager.appendToOutput(pyResult.output);
            }
        } else {
            // Handle errors from Python
            await OutputManager.appendToOutput(pyResult.error, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            result = { success: false, error: pyResult.error };
        }
    } catch (e) {
        const errorMsg = e.message || "An unknown JavaScript error occurred.";
        await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
        result = { success: false, error: errorMsg };
    }

    // Finalize UI for interactive commands
    if (isInteractive) {
        await finalizeInteractiveModeUI(rawCommandText);
    }

    return result || { success: true, output: "" };
}

// --- Command Execution Wrapper ---
const CommandExecutor = {
    processSingleCommand: executePythonCommand,
    getActiveJobs: () => activeJobs,
};


// --- Kernel Context Creation ---
async function createKernelContext(options = {}) {
    const { asUser = null } = options;
    const { FileSystemManager, UserManager, GroupManager, StorageManager, Config, SessionManager, AliasManager, HistoryManager } = dependencies;

    let user;
    let primaryGroup;

    if (asUser) {
        user = { name: asUser.name };
        primaryGroup = asUser.primaryGroup;
    } else {
        user = await UserManager.getCurrentUser();
        primaryGroup = await UserManager.getPrimaryGroupForUser(user.name);
    }

    const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
    const allUsernames = Object.keys(allUsers);
    const userGroupsMap = {};
    for (const username of allUsernames) {
        userGroupsMap[username] = await GroupManager.getGroupsForUser(username);
    }
    if (!userGroupsMap['Guest']) {
        userGroupsMap['Guest'] = await GroupManager.getGroupsForUser('Guest');
    }
    const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);

    // This syncs the JS-side session state to Python before execution
    await OopisOS_Kernel.syscall("alias", "load_aliases", [await AliasManager.getAllAliases()]);
    await OopisOS_Kernel.syscall("history", "set_history", [await HistoryManager.getFullHistory()]);

    return JSON.stringify({
        current_path: FileSystemManager.getCurrentPath(),
        user_context: { name: user.name, group: primaryGroup },
        users: allUsers,
        user_groups: userGroupsMap,
        groups: await GroupManager.getAllGroups(),
        jobs: activeJobs,
        config: { MAX_VFS_SIZE: Config.FILESYSTEM.MAX_VFS_SIZE },
        api_key: apiKey,
        session_start_time: window.sessionStartTime.toISOString(),
        session_stack: await SessionManager.getStack()
    });
}

// --- Effect Handler ---
async function handleEffect(result, options) {
    const {
        FileSystemManager, TerminalUI, SoundManager, SessionManager, AppLayerManager,
        UserManager, ErrorHandler, Config, OutputManager, PagerManager, Utils,
        GroupManager, NetworkManager, MessageBusManager, ModalManager, StorageManager,
        AuditManager, StorageHAL, SudoManager
    } = dependencies;

    switch (result.effect) {
        case 'sudo_exec': {
            const currentUser = await UserManager.getCurrentUser();
            const executeAsRoot = async () => {
                SudoManager.updateUserTimestamp(currentUser.name);
                await AuditManager.log(currentUser.name, 'SUDO_SUCCESS', `Command: ${result.command}`);
                const execOptions = { ...options, isInteractive: false, asUser: { name: 'root', primaryGroup: 'root' }, isSudoContinuation: true };
                await CommandExecutor.processSingleCommand(result.command, execOptions);
            };

            if (SudoManager.isUserTimestampValid(currentUser.name)) {
                await executeAsRoot();
                break;
            }

            let passwordToTry = result.password;
            if (passwordToTry === null) {
                passwordToTry = await new Promise((resolve) => {
                    ModalManager.request({
                        context: 'terminal', type: 'input',
                        messageLines: [`[sudo] password for ${currentUser.name}:`],
                        obscured: true,
                        onConfirm: (pwd) => resolve(pwd),
                        onCancel: () => resolve(null),
                        options
                    });
                });
            }

            if (passwordToTry === null) {
                await AuditManager.log(currentUser.name, 'SUDO_FAILURE', `Command: ${result.command} (Reason: Password prompt cancelled)`);
                await OutputManager.appendToOutput("sudo: authentication cancelled", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                break;
            }

            const verifyResultJson = await OopisOS_Kernel.syscall("users", "verify_password", [currentUser.name, passwordToTry]);
            const verifyResult = JSON.parse(verifyResultJson);

            if (verifyResult.success && verifyResult.data) {
                await executeAsRoot();
            } else {
                await AuditManager.log(currentUser.name, 'SUDO_FAILURE', `Command: ${result.command} (Reason: Incorrect password)`);
                await OutputManager.appendToOutput("sudo: incorrect password", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;
        }
        case 'full_reset':
            await OutputManager.appendToOutput("Performing factory reset... The system will reboot.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
            await StorageHAL.clear(); // Clears IndexedDB
            localStorage.clear(); // Clears all local storage for this origin
            setTimeout(() => window.location.reload(), 2000); // Give user time to read message
            break;
        case 'confirm':
            ModalManager.request({
                context: 'terminal',
                type: 'confirm',
                messageLines: result.message,
                onConfirm: async () => {
                    if (result.on_confirm_command) {
                        await CommandExecutor.processSingleCommand(result.on_confirm_command, { isInteractive: false });
                    } else if (result.on_confirm) {
                        await handleEffect(result.on_confirm, options);
                    }
                },
                onCancel: () => {
                    OutputManager.appendToOutput('Operation cancelled.', { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                }
            });
            break;
        case 'execute_script': {
            const commandsToRun = result.lines || result.commands;
            const scriptArgs = result.args || [];
            const envMgr = dependencies.EnvironmentManager;
            await envMgr.push();
            try {
                for (const item of commandsToRun) {
                    let commandText;
                    let passwordPipe = null;

                    if (typeof item === 'string') {
                        commandText = item;
                    } else {
                        commandText = item.command;
                        passwordPipe = item.password_pipe;
                    }
                    for (let i = 0; i < scriptArgs.length; i++) {
                        commandText = commandText.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
                    }
                    const execOptions = {
                        isInteractive: false,
                        scriptingContext: options.scriptingContext,
                        stdinContent: passwordPipe ? passwordPipe.join('\n') : null
                    };
                    const commandResult = await CommandExecutor.processSingleCommand(commandText, execOptions);
                    if (!commandResult.success) {
                        break;
                    }
                }
            } finally {
                await envMgr.pop();
            }
            break;
        }
        case 'execute_commands': {
            const commandsToRun = result.lines || result.commands;
            const scriptArgs = result.args || [];
            for (const item of commandsToRun) {
                let commandText;
                let passwordPipe = null;

                if (typeof item === 'string') {
                    commandText = item;
                } else {
                    commandText = item.command;
                    passwordPipe = item.password_pipe;
                }
                for (let i = 0; i < scriptArgs.length; i++) {
                    commandText = commandText.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
                }
                const execOptions = {
                    isInteractive: false,
                    scriptingContext: options.scriptingContext,
                    stdinContent: passwordPipe ? passwordPipe.join('\n') : null
                };
                const commandResult = await CommandExecutor.processSingleCommand(commandText, execOptions);
                if (!commandResult.success) {
                    break;
                }
            }
            break;
        }

        case 'useradd': {
            const newPassword = await new Promise((resolve) => {
                ModalManager.request({
                    context: 'terminal', type: 'input', messageLines: [`Enter new password for ${result.username}:`],
                    obscured: true, onConfirm: (pwd) => resolve(pwd), onCancel: () => resolve(null)
                });
            });
            if (newPassword === null) {
                await OutputManager.appendToOutput("User creation cancelled.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                break;
            }
            const confirmPassword = await new Promise((resolve) => {
                ModalManager.request({
                    context: 'terminal', type: 'input', messageLines: [`Confirm new password for ${result.username}:`],
                    obscured: true, onConfirm: (pwd) => resolve(pwd), onCancel: () => resolve(null)
                });
            });
            if (confirmPassword === null) {
                await OutputManager.appendToOutput("User creation cancelled.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                break;
            }
            if (newPassword !== confirmPassword) {
                await OutputManager.appendToOutput(Config.MESSAGES.PASSWORD_MISMATCH, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                break;
            }
            const command = `useradd ${result.username}`;
            const stdin = `${newPassword}\n${confirmPassword}`;
            await CommandExecutor.processSingleCommand(command, { isInteractive: false, stdinContent: stdin });
            break;
        }

        case 'removeuser': {
            const { username, remove_home } = result;
            const message = [`Are you sure you want to permanently delete user '${username}'?`];
            if (remove_home) {
                message.push("This will also delete their home directory and all its contents.");
            }
            message.push("This action cannot be undone.");

            ModalManager.request({
                context: 'terminal', type: 'confirm', messageLines: message,
                onConfirm: async () => {
                    const deleteResultJson = await OopisOS_Kernel.syscall("users", "delete_user_and_data", [username, remove_home]);
                    const deleteResult = JSON.parse(deleteResultJson);
                    if (deleteResult.success) {
                        await UserManager.syncUsersFromKernel();
                        const allGroups = await GroupManager.getAllGroups();
                        await GroupManager.syncAndSave(allGroups);
                        await OutputManager.appendToOutput(`User '${username}' removed successfully.`);
                    } else {
                        await OutputManager.appendToOutput(`Error: ${deleteResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    }
                },
            });
            break;
        }


        case 'background_job':
            const newJobId = ++backgroundProcessIdCounter;
            const abortController = new AbortController();
            const jobUser = (await UserManager.getCurrentUser()).name;

            activeJobs[newJobId] = {
                command: result.command_string, status: 'running', user: jobUser,
                startTime: new Date().toISOString(), abortController: abortController
            };
            MessageBusManager.registerJob(newJobId);

            (async () => {
                const bgOptions = { ...options, isInteractive: false, suppressOutput: true, signal: abortController.signal };
                await executePythonCommand(result.command_string, bgOptions);
                if (activeJobs[newJobId]) {
                    delete activeJobs[newJobId];
                    MessageBusManager.unregisterJob(newJobId);
                }
            })();
            await OutputManager.appendToOutput(`[${newJobId}] ${result.command_string}`);
            break;
        case 'login':
        case 'su': { // 'su' and 'login' effects are functionally identical
            const loginResult = await UserManager.loginUser(result.username, result.password);
            if (!loginResult.success) {
                await OutputManager.appendToOutput(loginResult.error.message || loginResult.error, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;
        }

        case 'logout': {
            const poppedUser = await SessionManager.popUserFromStack();
            if (poppedUser) {
                const newCurrentUser = await SessionManager.getCurrentUserFromStack();
                await OutputManager.appendToOutput(`Logged out of ${poppedUser}. Current user is now ${newCurrentUser}.`);
                await SessionManager.loadAutomaticState(newCurrentUser);
            } else {
                await OutputManager.appendToOutput("Not logged in to any additional user sessions.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
            }
            break;
        }

        case 'passwd': {
            const newPassword = await new Promise((resolve) => {
                ModalManager.request({
                    context: 'terminal', type: 'input',
                    messageLines: [`Enter new password for ${result.username}:`],
                    obscured: true, onConfirm: (pwd) => resolve(pwd), onCancel: () => resolve(null)
                });
            });
            if (newPassword === null) {
                await OutputManager.appendToOutput("Password change cancelled.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                break;
            }
            const confirmPassword = await new Promise((resolve) => {
                ModalManager.request({
                    context: 'terminal', type: 'input',
                    messageLines: [`Confirm new password for ${result.username}:`],
                    obscured: true, onConfirm: (pwd) => resolve(pwd), onCancel: () => resolve(null)
                });
            });
            if (confirmPassword === null) {
                await OutputManager.appendToOutput("Password change cancelled.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                break;
            }
            if (newPassword !== confirmPassword) {
                await OutputManager.appendToOutput(Config.MESSAGES.PASSWORD_MISMATCH, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                break;
            }

            const changeResultJson = await OopisOS_Kernel.syscall("users", "change_password", [result.username, newPassword]);
            const changeResult = JSON.parse(changeResultJson);

            if (changeResult.success) {
                await UserManager.syncUsersFromKernel();
                await OutputManager.appendToOutput(`Password for ${result.username} changed successfully.`);
            } else {
                await OutputManager.appendToOutput(`Error: ${changeResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;
        }

        case 'signal_job':
            const signalResult = sendSignalToJob(result.job_id, result.signal);
            if (!signalResult.success) {
                await OutputManager.appendToOutput(signalResult.error, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;

        case 'change_directory':
            await FileSystemManager.setCurrentPath(result.path);
            await TerminalUI.updatePrompt();
            break;

        case 'clear_screen':
            await OutputManager.clearOutput();
            break;

        case 'beep':
            SoundManager.beep();
            break;

        case 'reboot':
            await OutputManager.appendToOutput("Rebooting...");
            setTimeout(() => window.location.reload(), 1000);
            break;

        case 'delay':
            await Utils.safeDelay(result.milliseconds);
            break;

        case 'launch_app':
            const App = window[result.app_name + "Manager"];
            if (App) {
                const appInstance = new App();
                AppLayerManager.show(appInstance, { ...options, dependencies, ...result.options });
            } else {
                console.error(`Attempted to launch unknown app: ${result.app_name}`);
            }
            break;

        case 'page_output':
            // Non-interactive scripts shouldn't hang on the pager.
            // We just pass the content through as standard output.
            if (options.scriptingContext && options.scriptingContext.isScripting) {
                await OutputManager.appendToOutput(result.content);
            } else if (dependencies.PagerManager && typeof dependencies.PagerManager === 'function') {
                const pagerApp = new dependencies.PagerManager();
                AppLayerManager.show(pagerApp, {
                    dependencies,
                    content: result.content,
                    mode: result.mode
                });
            } else {
                // Fallback: If PagerManager is unavailable, do not throw; just print.
                await OutputManager.appendToOutput(result.content);
            }
            break;

        case 'trigger_upload_flow':
            return new Promise(async (resolve) => {
                const input = Utils.createElement("input", { type: "file", multiple: true });
                input.onchange = async (e) => {
                    const files = e.target.files;
                    document.body.removeChild(input);
                    if (!files || files.length === 0) {
                        resolve({success: true, output: "Upload cancelled."});
                        return;
                    }
                    const filesForPython = await Promise.all(Array.from(files).map(file => {
                        return new Promise((res, rej) => {
                            const reader = new FileReader();
                            reader.onload = (event) => res({ name: file.name, path: FileSystemManager.getAbsolutePath(file.name), content: event.target.result });
                            reader.onerror = () => rej(new Error(`Could not read file: ${file.name}`));
                            reader.readAsText(file);
                        });
                    }));
                    const userContext = await createKernelContext();
                    const uploadResult = JSON.parse(await OopisOS_Kernel.execute_command("_upload_handler", userContext, JSON.stringify(filesForPython)));
                    await OutputManager.appendToOutput(uploadResult.output || uploadResult.error, { typeClass: uploadResult.success ? null : 'text-error' });
                    resolve({success: uploadResult.success});
                };
                document.body.appendChild(input);
                input.click();
            });

        case 'netcat_listen':
            await OutputManager.appendToOutput(`Listening on instance ${NetworkManager.getInstanceId()} in '${result.execute ? 'execute' : 'print'}' mode...`);
            NetworkManager.setListenCallback((payload) => {
                const { sourceId, data } = payload;
                if (result.execute) {
                    OutputManager.appendToOutput(`[NET EXEC from ${sourceId}]> ${data}`);
                    executePythonCommand(data, { isInteractive: false });
                } else {
                    OutputManager.appendToOutput(`[NET] From ${sourceId}: ${data}`);
                }
            });
            break;

        case 'netcat_send':
            await NetworkManager.sendMessage(result.targetId, 'direct_message', result.message);
            break;

        case 'netstat_display':
            const output = [`Your Instance ID: ${NetworkManager.getInstanceId()}`, "\nDiscovered Remote Instances:"];
            const instances = NetworkManager.getRemoteInstances();
            if (instances.length === 0) output.push("  (None)");
            else instances.forEach(id => {
                const peer = NetworkManager.getPeers().get(id);
                output.push(`  - ${id} (Status: ${peer ? peer.connectionState : 'Disconnected'})`);
            });
            await OutputManager.appendToOutput(output.join('\n'));
            break;

        case 'read_messages':
            const messages = MessageBusManager.getMessages(result.job_id);
            // This implicitly becomes the command's output
            await OutputManager.appendToOutput(messages.join(" "));
            break;

        case 'post_message':
            MessageBusManager.postMessage(result.job_id, result.message);
            break;

        case 'play_sound':
            if (!SoundManager.isInitialized) { await SoundManager.initialize(); }
            SoundManager.playNote(result.notes, result.duration);
            const durationInSeconds = new Tone.Time(result.duration).toSeconds();
            await new Promise(resolve => setTimeout(resolve, Math.ceil(durationInSeconds * 1000)));
            break;

        case 'sync_session_state':
            if (result.aliases) {
                await OopisOS_Kernel.syscall("alias", "load_aliases", [result.aliases]);
                StorageManager.saveItem(Config.STORAGE_KEYS.ALIAS_DEFINITIONS, result.aliases, "Aliases");
            }
            if (result.env) {
                await OopisOS_Kernel.syscall("env", "load", [result.env]);
                await SessionManager.saveAutomaticState((await UserManager.getCurrentUser()).name);
            }
            break;

        case 'sync_group_state':
            if (result.groups) {
                await GroupManager.syncAndSave(result.groups);
            }
            break;

        case 'sync_user_and_group_state':
            if (result.users) {
                await UserManager.syncUsersFromKernel(); // This fetches from Python kernel's memory
                // After syncing, save the new state to JS localStorage
                const allUsers = await OopisOS_Kernel.syscall("users", "get_all_users");
                const parsedUsers = JSON.parse(allUsers);
                if(parsedUsers.success){
                    StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, parsedUsers.data, "User Credentials");
                }
            }
            if (result.groups) {
                await GroupManager.syncAndSave(result.groups);
            }
            break;

        case 'dump_screen_text': {
            try {
                const textSource = document.getElementById('output');
                const innerText = textSource ? textSource.innerText : '';
                const destPathArg = result.path || 'screen.txt';
                const absPath = FileSystemManager.getAbsolutePath(destPathArg, FileSystemManager.getCurrentPath());
                const currentUser = await UserManager.getCurrentUser();
                const primaryGroup = await UserManager.getPrimaryGroupForUser(currentUser.name);
                const writeRes = await FileSystemManager.createOrUpdateFile(absPath, innerText, { currentUser: currentUser.name, primaryGroup });
                if (!writeRes.success) {
                    await OutputManager.appendToOutput(writeRes.error || 'Failed to write screen text.', { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                }
            } catch (e) {
                await OutputManager.appendToOutput(`printscreen error: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;
        }

        case 'capture_screenshot_png': {
            try {
                const target = document.getElementById('terminal') || document.body;
                const canvas = await html2canvas(target);
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = result.filename || 'SamwiseOS_Screenshot.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                await OutputManager.appendToOutput(`screenshot error: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
            break;
        }

        default:
            await OutputManager.appendToOutput(`Unknown effect from Python: ${result.effect}`, { typeClass: 'text-warning' });
            break;
    }
}

// --- Job Signal Handler ---
function sendSignalToJob(jobId, signal) {
    const job = activeJobs[jobId];
    if (!job) return { success: false, error: `Job ${jobId} not found.` };
    switch (signal.toUpperCase()) {
        case 'KILL': case 'TERM':
            if (job.abortController) {
                job.abortController.abort("Killed by user.");
                delete activeJobs[jobId];
                dependencies.MessageBusManager.unregisterJob(jobId);
            }
            break;
        case 'STOP': job.status = 'paused'; break;
        case 'CONT': job.status = 'running'; break;
        default: return { success: false, error: `Invalid signal '${signal}'.` };
    }
    return { success: true, output: `Signal ${signal} sent to job ${jobId}.` };
}


async function finalizeInteractiveModeUI(originalCommandText) {
    const { TerminalUI, AppLayerManager, HistoryManager } = dependencies;
    TerminalUI.clearInput();
    await TerminalUI.updatePrompt();
    if (!AppLayerManager.isActive()) {
        TerminalUI.showInputLine();
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }
    TerminalUI.scrollOutputToEnd();
    if (!TerminalUI.getIsNavigatingHistory() && originalCommandText.trim()) {
        await HistoryManager.resetIndex();
    }
    TerminalUI.setIsNavigatingHistory(false);
}

function initializeTerminalEventListeners(domElements, dependencies) {
    const { AppLayerManager, ModalManager, TerminalUI, TabCompletionManager, HistoryManager, SoundManager } = dependencies;

    domElements.terminalDiv.addEventListener("click", (e) => {
        if (AppLayerManager.isActive()) return;

        // If text has been selected, don't steal focus.
        // This allows the user to copy text from the output.
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            return;
        }

        if (!e.target.closest("button, a")) TerminalUI.focusInput();
    });

    document.addEventListener("keydown", async (e) => {
        if (ModalManager.isAwaiting()) {
            if (TerminalUI.isObscured()) {
                e.preventDefault();
                if (e.key === "Enter") {
                    await ModalManager.handleTerminalInput(TerminalUI.getCurrentInputValue());
                } else if (e.key === "Escape") {
                    await ModalManager.handleTerminalInput(null);
                } else if (e.key === "Backspace" || e.key === "Delete" || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                    TerminalUI.updateInputForObscure(e.key);
                }
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                await ModalManager.handleTerminalInput(TerminalUI.getCurrentInputValue());
            } else if (e.key === "Escape") {
                e.preventDefault();
                await ModalManager.handleTerminalInput(null);
            }
            return;
        }


        if (AppLayerManager.isActive()) {
            const activeApp = AppLayerManager.activeApp;
            if (activeApp?.handleKeyDown) activeApp.handleKeyDown(e);
            return;
        }

        if (e.target !== domElements.editableInputDiv) return;

        switch (e.key) {
            case "Enter":
                e.preventDefault();
                if (!SoundManager.isInitialized) await SoundManager.initialize();
                TabCompletionManager.resetCycle();
                // --- Call the new Python executor function ---
                await executePythonCommand(TerminalUI.getCurrentInputValue(), { isInteractive: true });
                break;
            case "ArrowUp":
                e.preventDefault();
                const prevCmd = await HistoryManager.getPrevious();
                if (prevCmd !== null) TerminalUI.setCurrentInputValue(prevCmd, true);
                break;
            case "ArrowDown":
                e.preventDefault();
                const nextCmd = await HistoryManager.getNext();
                if (nextCmd !== null) TerminalUI.setCurrentInputValue(nextCmd, true);
                break;
            case "Tab":
                e.preventDefault();
                const currentInput = TerminalUI.getCurrentInputValue();
                const result = await TabCompletionManager.handleTab(currentInput, TerminalUI.getSelection().start);
                if (result?.textToInsert !== null) {
                    TerminalUI.setCurrentInputValue(result.textToInsert, false);
                    TerminalUI.setCaretPosition(domElements.editableInputDiv, result.newCursorPos);
                }
                break;
        }
    });

    domElements.editableInputDiv.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\r?\n|\r/g, " ");
        TerminalUI.handlePaste(text);
    });
}

// Global dependencies object, will be populated on window.onload
const dependencies = {};

window.onload = async () => {
    const domElements = {
        terminalBezel: document.getElementById("terminal-bezel"),
        terminalDiv: document.getElementById("terminal"),
        outputDiv: document.getElementById("output"),
        inputLineContainerDiv: document.querySelector(".terminal__input-line"),
        promptContainer: document.getElementById("prompt-container"),
        editableInputContainer: document.getElementById("editable-input-container"),
        editableInputDiv: document.getElementById("editable-input"),
        appLayer: document.getElementById("app-layer"),
    };

    // Instantiate all manager classes
    const configManager = new ConfigManager();
    const storageManager = new StorageManager();
    const storageHAL = new StorageHAL();
    const groupManager = new GroupManager();
    const fsManager = new FileSystemManager(configManager);
    const sessionManager = new SessionManager();
    const sudoManager = new SudoManager();
    const messageBusManager = new MessageBusManager();
    const outputManager = new OutputManager();
    const terminalUI = new TerminalUI();
    const modalManager = new ModalManager();
    const appLayerManager = new AppLayerManager();
    const aliasManager = new AliasManager();
    const historyManager = new HistoryManager();
    const tabCompletionManager = new TabCompletionManager();
    const uiComponents = new UIComponents();
    const aiManager = new AIManager();
    const networkManager = new NetworkManager();
    const soundManager = new SoundManager();
    const auditManager = new AuditManager();
    const environmentManager = new EnvironmentManager(); // Define it here

    // Populate the global dependencies object
    Object.assign(dependencies, {
        Config: configManager, StorageManager: storageManager, FileSystemManager: fsManager,
        SessionManager: sessionManager, SudoManager: sudoManager, GroupManager: groupManager,
        MessageBusManager: messageBusManager, OutputManager: outputManager, TerminalUI: terminalUI,
        ModalManager: modalManager, AppLayerManager: appLayerManager, AliasManager: aliasManager,
        HistoryManager: historyManager, TabCompletionManager: tabCompletionManager, Utils: Utils,
        ErrorHandler: ErrorHandler, AIManager: aiManager, NetworkManager: networkManager,
        UIComponents: uiComponents, domElements: domElements, SoundManager: soundManager,
        AuditManager: auditManager,
        EnvironmentManager: environmentManager, // Add it to dependencies
        StorageHAL: storageHAL,
        CommandExecutor: CommandExecutor,
        // App classes
        PagerManager: window.PagerManager,
        TextAdventureModal: window.TextAdventureModal, Adventure_create: window.Adventure_create,
        BasicUI: window.BasicUI, ChidiUI: window.ChidiUI, EditorUI: window.EditorUI,
        ExplorerUI: window.ExplorerUI, GeminiChatUI: window.GeminiChatUI, LogUI: window.LogUI,
        PaintUI: window.PaintUI, TopUI: window.TopUI,
    });

    const userManager = new UserManager(dependencies);
    dependencies.UserManager = userManager;

    // Set dependencies for all managers
    Object.values(dependencies).forEach(dep => {
        if (dep && typeof dep.setDependencies === 'function') {
            dep.setDependencies(dependencies);
        }
    });
    // Special cases
    userManager.setDependencies(sessionManager, sudoManager, null, modalManager);
    sudoManager.setDependencies(fsManager, groupManager, configManager);

    outputManager.initialize(domElements);
    terminalUI.initialize(domElements);
    modalManager.initialize(domElements);
    appLayerManager.initialize(domElements);
    outputManager.initializeConsoleOverrides();

    await storageHAL.init();
    await OopisOS_Kernel.initialize(dependencies);

    const onboardingComplete = storageManager.loadItem(configManager.STORAGE_KEYS.ONBOARDING_COMPLETE, "Onboarding Status", false);
    if (!onboardingComplete) {
        startOnboardingProcess(dependencies);
        return;
    }

    // --- Post-Onboarding Initialization ---
    try {
        const fsJsonFromStorage = await storageHAL.load();
        if (fsJsonFromStorage) {
            await OopisOS_Kernel.syscall("filesystem", "load_state_from_json", [JSON.stringify(fsJsonFromStorage)]);
            await fsManager.setFsData(fsJsonFromStorage);
        } else {
            await outputManager.appendToOutput("No file system found. Initializing new one.", { typeClass: configManager.CSS_CLASSES.CONSOLE_LOG_MSG });
            await fsManager.initialize(configManager.USER.DEFAULT_NAME);
            const initialFsData = await fsManager.getFsData();
            await OopisOS_Kernel.syscall("filesystem", "load_state_from_json", [JSON.stringify(initialFsData)]);
            await storageHAL.save(initialFsData); // Save the initial state
        }

        await userManager.initializeDefaultUsers();
        await groupManager.initialize();
        await aliasManager.initialize();
        await sessionManager.initializeStack();

        // Check if we just created a user during onboarding.
        let initialUser = storageManager.loadItem(configManager.STORAGE_KEYS.LAST_CREATED_USER, "Last Created User", configManager.USER.DEFAULT_NAME);

        // If we found a newly created user, we need to add them to the session stack.
        if (initialUser !== configManager.USER.DEFAULT_NAME) {
            await sessionManager.pushUserToStack(initialUser);
        }

        const sessionStatus = await sessionManager.loadAutomaticState(initialUser);

        // Clean up the temporary user key so we don't use it again.
        if (initialUser !== configManager.USER.DEFAULT_NAME) {
            storageManager.removeItem(configManager.STORAGE_KEYS.LAST_CREATED_USER);
        }

        // Initialize environment if it's a new session state
        if (sessionStatus.newStateCreated) {
        }

        outputManager.clearOutput();
        if (sessionStatus.newStateCreated) {
            const currentUser = await userManager.getCurrentUser();
            await outputManager.appendToOutput(`${configManager.MESSAGES.WELCOME_PREFIX} ${currentUser.name}${configManager.MESSAGES.WELCOME_SUFFIX}`);
        }

        initializeTerminalEventListeners(domElements, dependencies);

        await terminalUI.updatePrompt();
        terminalUI.focusInput();
        console.log(`${configManager.OS.NAME} v.${configManager.OS.VERSION} loaded successfully!`);

    } catch (error) {
        console.error("Failed to initialize SamwiseOS on window.onload:", error, error.stack);
        if (domElements.outputDiv) {
            domElements.outputDiv.innerHTML += `<div class="text-error">FATAL ERROR: ${error.message}. Check console for details.</div>`;
        }
    }
};