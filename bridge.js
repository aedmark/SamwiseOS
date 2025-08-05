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
     * Initializes the Pyodide engine and loads the core Python kernel.
     * @param {object} dependencies - The main dependency container from OopisOS.
     * @returns {Promise<void>}
     */
    async initialize(dependencies) {
        this.dependencies = dependencies;
        const { OutputManager, Config } = this.dependencies;

        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });

            this.pyodide = await loadPyodide();

            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });

            // Create the directory structure within Pyodide's virtual FS first!
            this.pyodide.FS.mkdir('/core');
            this.pyodide.FS.mkdir('/core/commands');

            // Add the 'core' directory to Python's path so it can find the modules
            await this.pyodide.runPythonAsync(`
                import sys
                sys.path.append('/core')
            `);


            // Fetch and load all necessary Python files
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
                '/core/commands/__init__.py': null // Will be created empty
            };

            for (const [pyPath, jsPath] of Object.entries(filesToLoad)) {
                if (jsPath) {
                    const code = await (await fetch(jsPath)).text();
                    this.pyodide.FS.writeFile(pyPath, code, { encoding: 'utf8' });
                } else {
                    this.pyodide.FS.writeFile(pyPath, '', { encoding: 'utf8' });
                }
            }

            // --- THE NEW, ROBUST INITIALIZATION ---
            // 1. Import the kernel module.
            this.kernel = this.pyodide.pyimport("kernel");

            // 2. Formally pass the JavaScript save function to the Python kernel.
            this.kernel.initialize_kernel(this.saveFileSystem);
            // -----------------------------------------

            this.isReady = true;
            await OutputManager.appendToOutput("OopisOS Python Kernel is online.", {
                typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
            });

        } catch (error) {
            this.isReady = false;
            console.error("Pyodide initialization failed:", error);
            await OutputManager.appendToOutput(`FATAL: Python Kernel failed to load: ${error.message}`, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
            });
        }
    },

    /**
     * Executes a command in the Python kernel.
     * @param {string} commandString - The command to execute.
     * @param {string} jsContextJson - The JSON string of the current JS context.
     * @returns {string|null} The result from the Python kernel, or null on error.
     */
    execute_command(commandString, jsContextJson) {
        if (!this.isReady || !this.kernel) {
            console.error("Kernel not ready. Cannot execute command.");
            return JSON.stringify({"success": false, "error": "Error: Python kernel is not ready."});
        }
        try {
            return this.kernel.execute_command(commandString, jsContextJson);
        } catch (error) {
            console.error("Error executing Python command:", error);
            return JSON.stringify({"success": false, "error": `Python execution error: ${error.message}`});
        }
    },

    /**
     * JavaScript helper function exposed to Python for saving the filesystem state.
     * @param {string} fsJsonString - The filesystem state serialized as a JSON string.
     */
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