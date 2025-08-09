// gem/bridge.js

/**
 * @file bridge.js
 * @description Establishes the communication bridge between the JavaScript frontend
 * and the Python/WebAssembly backend powered by Pyodide.
 */

const OopisOS_Kernel = {
    isReady: false,
    pyodide: null,
    kernel: null,
    dependencies: null,

    /**
     * Creates a JSON string containing the current user and path context.
     * This is passed to Python functions that need session context.
     * @private
     * @returns {string} A JSON string of the kernel context.
     */
    _createKernelContext() {
        const { FileSystemManager, UserManager, GroupManager, StorageManager, Config } = this.dependencies;
        const user = UserManager.getCurrentUser();

        // [NEW] Build the full user-to-groups mapping for Python-side permission checks
        const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const allUsernames = Object.keys(allUsers);
        const userGroupsMap = {};
        for (const username of allUsernames) {
            userGroupsMap[username] = GroupManager.getGroupsForUser(username);
        }
        if (!userGroupsMap['Guest']) {
            userGroupsMap['Guest'] = GroupManager.getGroupsForUser('Guest');
        }

        return JSON.stringify({
            current_path: FileSystemManager.getCurrentPath(),
            user_context: { name: user.name, group: UserManager.getPrimaryGroupForUser(user.name) },
            user_groups: userGroupsMap // [FIXED] Add the complete map to the context
        });
    },

    async initialize(dependencies) {
        this.dependencies = dependencies;
        const { OutputManager, Config, CommandRegistry } = this.dependencies;
        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
            this.pyodide = await loadPyodide({
                indexURL: "./dist/pyodide/"
            });
            await this.pyodide.loadPackage("cryptography");
            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });

            this.pyodide.FS.mkdir('/core');
            this.pyodide.FS.mkdir('/core/commands');
            this.pyodide.FS.mkdir('/core/apps');
            await this.pyodide.runPythonAsync(`import sys\nsys.path.append('/core')`);

            const filesToLoad = {
                '/core/kernel.py': './core/kernel.py',
                '/core/filesystem.py': './core/filesystem.py',
                '/core/executor.py': './core/executor.py',
                '/core/session.py': './core/session.py',
                '/core/groups.py': './core/groups.py',
                '/core/users.py': './core/users.py',
                '/core/sudo.py': './core/sudo.py',
                '/core/ai_manager.py': './core/ai_manager.py',
                '/core/commands/gemini.py': './core/commands/gemini.py',
                '/core/commands/chidi.py': './core/commands/chidi.py',
                '/core/commands/remix.py': './core/commands/remix.py',
                '/core/commands/sudo.py': './core/commands/sudo.py',
                '/core/commands/visudo.py': './core/commands/visudo.py',
                '/core/commands/useradd.py': './core/commands/useradd.py',
                '/core/commands/usermod.py': './core/commands/usermod.py',
                '/core/commands/passwd.py': './core/commands/passwd.py',
                '/core/commands/removeuser.py': './core/commands/removeuser.py',
                '/core/commands/groupadd.py': './core/commands/groupadd.py',
                '/core/commands/groupdel.py': './core/commands/groupdel.py',
                '/core/commands/login.py': './core/commands/login.py',
                '/core/commands/logout.py': './core/commands/logout.py',
                '/core/commands/su.py': './core/commands/su.py',
                '/core/commands/alias.py': './core/commands/alias.py',
                '/core/commands/unalias.py': './core/commands/unalias.py',
                '/core/commands/set.py': './core/commands/set.py',
                '/core/commands/unset.py': './core/commands/unset.py',
                '/core/commands/history.py': './core/commands/history.py',
                '/core/commands/date.py': './core/commands/date.py',
                '/core/commands/pwd.py': './core/commands/pwd.py',
                '/core/commands/echo.py': './core/commands/echo.py',
                '/core/commands/ls.py': './core/commands/ls.py',
                '/core/commands/whoami.py': './core/commands/whoami.py',
                '/core/commands/clear.py': './core/commands/clear.py',
                '/core/commands/help.py': './core/commands/help.py',
                '/core/commands/man.py': './core/commands/man.py',
                '/core/commands/cat.py': './core/commands/cat.py',
                '/core/commands/mkdir.py': './core/commands/mkdir.py',
                '/core/commands/touch.py': './core/commands/touch.py',
                '/core/commands/rm.py': './core/commands/rm.py',
                '/core/commands/grep.py': './core/commands/grep.py',
                '/core/commands/uniq.py': './core/commands/uniq.py',
                '/core/commands/wc.py': './core/commands/wc.py',
                '/core/commands/head.py': './core/commands/head.py',
                '/core/commands/delay.py': './core/commands/delay.py',
                '/core/commands/rmdir.py': './core/commands/rmdir.py',
                '/core/commands/tail.py': './core/commands/tail.py',
                '/core/commands/diff.py': './core/commands/diff.py',
                '/core/commands/beep.py': './core/commands/beep.py',
                '/core/commands/chmod.py': './core/commands/chmod.py',
                '/core/commands/chown.py': './core/commands/chown.py',
                '/core/commands/chgrp.py': './core/commands/chgrp.py',
                '/core/commands/tree.py': './core/commands/tree.py',
                '/core/commands/du.py': './core/commands/du.py',
                '/core/commands/nl.py': './core/commands/nl.py',
                '/core/commands/ln.py': './core/commands/ln.py',
                '/core/commands/patch.py': './core/commands/patch.py',
                '/core/commands/comm.py': './core/commands/comm.py',
                '/core/commands/shuf.py': './core/commands/shuf.py',
                '/core/commands/storyboard.py': './core/commands/storyboard.py',
                '/core/commands/forge.py': './core/commands/forge.py',
                '/core/commands/csplit.py': './core/commands/csplit.py',
                '/core/commands/awk.py': './core/commands/awk.py',
                '/core/commands/expr.py': './core/commands/expr.py',
                '/core/commands/rename.py': './core/commands/rename.py',
                '/core/commands/zip.py': './core/commands/zip.py',
                '/core/commands/unzip.py': './core/commands/unzip.py',
                '/core/commands/reboot.py': './core/commands/reboot.py',
                '/core/commands/ps.py': './core/commands/ps.py',
                '/core/commands/kill.py': './core/commands/kill.py',
                '/core/commands/sync.py': './core/commands/sync.py',
                '/core/commands/ocrypt.py': './core/commands/ocrypt.py',
                '/core/commands/reset.py': './core/commands/reset.py',
                '/core/commands/fsck.py': './core/commands/fsck.py',
                '/core/commands/printf.py': './core/commands/printf.py',
                '/core/commands/xor.py': './core/commands/xor.py',
                '/core/commands/wget.py': './core/commands/wget.py',
                '/core/commands/curl.py': './core/commands/curl.py',
                '/core/commands/bc.py': './core/commands/bc.py',
                '/core/commands/cp.py': './core/commands/cp.py',
                '/core/commands/sed.py': './core/commands/sed.py',
                '/core/commands/ping.py': './core/commands/ping.py',
                '/core/commands/xargs.py': './core/commands/xargs.py',
                '/core/commands/cut.py': './core/commands/cut.py',
                '/core/commands/df.py': './core/commands/df.py',
                '/core/commands/groups.py': './core/commands/groups.py',
                '/core/commands/listusers.py': './core/commands/listusers.py',
                '/core/commands/tr.py': './core/commands/tr.py',
                '/core/commands/base64.py': './core/commands/base64.py',
                '/core/commands/cksum.py': './core/commands/cksum.py',
                '/core/commands/edit.py': './core/commands/edit.py',
                '/core/commands/explore.py': './core/commands/explore.py',
                '/core/commands/log.py': './core/commands/log.py',
                '/core/commands/paint.py': './core/commands/paint.py',
                '/core/commands/top.py': './core/commands/top.py',
                '/core/commands/basic.py': './core/commands/basic.py',
                '/core/commands/adventure.py': './core/commands/adventure.py',
                '/core/commands/find.py': './core/commands/find.py',
                '/core/commands/sort.py': './core/commands/sort.py',
                '/core/commands/cd.py': './core/commands/cd.py',
                '/core/commands/fg.py': './core/commands/fg.py',
                '/core/commands/bg.py': './core/commands/bg.py',
                '/core/commands/committee.py': './core/commands/committee.py',
                '/core/commands/jobs.py': './core/commands/jobs.py',
                '/core/commands/binder.py': './core/commands/binder.py',
                '/core/commands/bulletin.py': './core/commands/bulletin.py',
                '/core/commands/agenda.py': './core/commands/agenda.py',
                '/core/commands/clearfs.py': './core/commands/clearfs.py',
                '/core/commands/upload.py': './core/commands/upload.py',
                '/core/commands/planner.py': './core/commands/planner.py',
                '/core/commands/__init__.py': null,
                '/core/apps/__init__.py': null,
                '/core/apps/editor.py': './core/apps/editor.py',
                '/core/apps/explorer.py': './core/apps/explorer.py',
                '/core/apps/paint.py': './core/apps/paint.py',
                '/core/apps/adventure.py': './core/apps/adventure.py',
                '/core/apps/top.py': './core/apps/top.py',
                '/core/apps/log.py': './core/apps/log.py',
                '/core/apps/basic.py': './core/apps/basic.py'
            };
            for (const [pyPath, jsPath] of Object.entries(filesToLoad)) {
                if (jsPath) {
                    const code = await (await fetch(jsPath)).text();
                    this.pyodide.FS.writeFile(pyPath, code, { encoding: 'utf8' });
                } else {
                    this.pyodide.FS.writeFile(pyPath, '', { encoding: 'utf8' });
                }
            }

            this.kernel = this.pyodide.pyimport("kernel");
            this.kernel.initialize_kernel(this.saveFileSystem);

            const pythonCommands = this.kernel.command_executor.commands.toJs();
            pythonCommands.forEach(cmd => CommandRegistry.addCommandToManifest(cmd));

            // Expose the Python session managers to the JS kernel object
            this.envManager = this.kernel.env_manager;
            this.historyManager = this.kernel.history_manager;
            this.aliasManager = this.kernel.alias_manager;
            this.sessionManager = this.kernel.session_manager;
            this.groupManager = this.kernel.group_manager;
            this.userManager = this.kernel.user_manager;
            this.sudoManager = this.kernel.sudo_manager;

            this.isReady = true;
            await OutputManager.appendToOutput("OopisOS Python Kernel is online.", { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
        } catch (error) {
            this.isReady = false;
            console.error("Pyodide initialization failed:", error);
            await OutputManager.appendToOutput(`FATAL: Python Kernel failed to load: ${error.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
        }
    },

    execute_command(commandString, jsContextJson, stdinContent = null) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.execute_command(commandString, jsContextJson, stdinContent);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    writeFile(path, content, jsContextJson) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.write_file(path, content, jsContextJson);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    createDirectory(path, jsContextJson) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.create_directory(path, jsContextJson);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    chidi_analysis(jsContextJson, filesContext, analysisType, question = null) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.chidi_analysis(jsContextJson, filesContext, analysisType, question);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    renameNode(oldPath, newPath, jsContextJson) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.rename_node(oldPath, newPath, jsContextJson);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    explorerGetView(path, jsContextJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.explorer_get_view(path, jsContextJson);
    },

    explorerToggleTree(path) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.explorer_toggle_tree(path);
    },

    explorerCreateNode(path, name, nodeType, jsContextJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.explorer_create_node(path, name, nodeType, jsContextJson);
    },

    explorerRenameNode(oldPath, newName, jsContextJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.explorer_rename_node(oldPath, newName, jsContextJson);
    },

    explorerDeleteNode(path, jsContextJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.explorer_delete_node(path, jsContextJson);
    },

    editorLoadFile(filePath, fileContent) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.editor_load_file(filePath, fileContent);
    },

    editorPushUndo(content) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.editor_push_undo(content);
    },

    editorUndo() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.editor_undo();
    },

    editorRedo() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.editor_redo();
    },

    editorUpdateOnSave(path, content) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.editor_update_on_save(path, content);
    },

    paintGetInitialState(filePath, fileContent) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.paint_get_initial_state(filePath, fileContent);
    },

    paintPushUndoState(canvasDataJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.paint_push_undo_state(canvasDataJson);
    },

    paintUndo() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.paint_undo();
    },

    paintRedo() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.paint_redo();
    },

    paintUpdateOnSave(path) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.paint_update_on_save(path);
    },

    adventureInitializeState(adventureDataJson, scriptingContextJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.adventure_initialize_state(adventureDataJson, scriptingContextJson);
    },

    adventureProcessCommand(command) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.adventure_process_command(command);
    },

    adventureCreatorInitialize(filename, initialDataJson) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.adventure_creator_initialize(filename, initialDataJson);
    },

    adventureCreatorGetPrompt() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.adventure_creator_get_prompt();
    },

    adventureCreatorProcessCommand(command) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.adventure_creator_process_command(command);
    },

    top_get_process_list(jobs) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.top_get_process_list(jobs);
    },

    log_ensure_dir() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.log_ensure_dir(this._createKernelContext());
    },

    log_load_entries() {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.log_load_entries(this._createKernelContext());
    },

    log_save_entry(path, content) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.log_save_entry(path, content, this._createKernelContext());
    },

    basic_run_program(programText, outputCallback, inputCallback) {
        if (!this.isReady) return JSON.stringify({ success: false, error: "Kernel not ready." });
        return this.kernel.basic_run_program(programText, outputCallback, inputCallback);
    },

    async saveFileSystem(fsJsonString) {
        const { StorageHAL } = OopisOS_Kernel.dependencies;
        try {
            const fsData = JSON.parse(fsJsonString);
            await StorageHAL.save(fsData);
        } catch (e) {
            console.error("JS Bridge: Failed to save filesystem state.", e);
        }
    }
};