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
        const { OutputManager, Config } = this.dependencies;
        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
            this.pyodide = await loadPyodide();
            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });

            this.pyodide.FS.mkdir('/core');
            this.pyodide.FS.mkdir('/core/commands');
            await this.pyodide.runPythonAsync(`import sys\nsys.path.append('/core')`);

            const filesToLoad = {
                '/core/kernel.py': './core/kernel.py',
                '/core/filesystem.py': './core/filesystem.py',
                '/core/executor.py': './core/executor.py',
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
            this.isReady = true;
            await OutputManager.appendToOutput("OopisOS Python Kernel is online.", { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
        } catch (error) {
            this.isReady = false;
            console.error("Pyodide initialization failed:", error);
            await OutputManager.appendToOutput(`FATAL: Python Kernel failed to load: ${error.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
        }
    },

    execute_command(commandString, jsContextJson) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.execute_command(commandString, jsContextJson);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    // --- NEW FILESYSTEM BRIDGE FUNCTIONS ---

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

    renameNode(oldPath, newPath) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready." });
        }
        try {
            return this.kernel.rename_node(oldPath, newPath);
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Python execution error: ${error.message}` });
        }
    },

    // --- END NEW FUNCTIONS ---

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