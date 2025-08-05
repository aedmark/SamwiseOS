/**
 * @file bridge.js
 * @description Establishes the communication bridge between the JavaScript frontend
 * and the Python/WebAssembly backend powered by Pyodide.
 */

const OopisOS_Kernel = {
    isReady: false,
    pyodide: null,
    kernel: null,

    /**
     * Initializes the Pyodide engine and loads the core Python kernel.
     * @param {object} dependencies - The main dependency container from OopisOS.
     * @returns {Promise<void>}
     */
    async initialize(dependencies) {
        const { OutputManager, Config } = dependencies;

        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });

            this.pyodide = await loadPyodide();

            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });

            // Add the 'commands' directory to Python's path
            await this.pyodide.runPythonAsync(`
                import sys
                sys.path.append('/core')
            `);

            // Fetch and load the main kernel file
            const kernelCode = await (await fetch('./core/kernel.py')).text();
            this.pyodide.FS.writeFile('/core/kernel.py', kernelCode);

            // Fetch and load the date command module
            const dateCommandCode = await (await fetch('./core/commands/date.py')).text();
            this.pyodide.FS.mkdir('/core/commands');
            this.pyodide.FS.writeFile('/core/commands/date.py', dateCommandCode);

            // Create an empty __init__.py to make 'commands' a package
            this.pyodide.FS.writeFile('/core/commands/__init__.py', '');


            this.kernel = this.pyodide.pyimport("kernel");

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
     * @returns {string|null} The result from the Python kernel, or null on error.
     */
    execute_command(commandString) {
        if (!this.isReady || !this.kernel) {
            console.error("Kernel not ready. Cannot execute command.");
            return "Error: Python kernel is not ready.";
        }
        try {
            return this.kernel.execute_command(commandString);
        } catch (error) {
            console.error("Error executing Python command:", error);
            return `Python execution error: ${error.message}`;
        }
    }
};