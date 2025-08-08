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

    async initialize(dependencies) {
        this.dependencies = dependencies;
        const { OutputManager, Config, CommandRegistry } = this.dependencies;
        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
            this.pyodide = await loadPyodide();
            await this.pyodide.loadPackage("cryptography");
            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });

            this.pyodide.FS.mkdir('/core');
            this.pyodide.FS.mkdir('/core/commands');
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
                '/core/commands/__init__.py': null
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