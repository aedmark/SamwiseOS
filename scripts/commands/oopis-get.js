// scripts/commands/oopis-get.js

/**
 * @fileoverview This file defines the 'oopis-get' command, the package manager
 * for OopisOS, responsible for listing, installing, and removing packages.
 * @module commands/oopis-get
 */

/**
 * Represents the 'oopis-get' command for package management.
 * @class OopisGetCommand
 * @extends Command
 */
window.OopisGetCommand = class OopisGetCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "oopis-get",
            description: "Manages OopisOS packages from a central repository.",
            helpText: `Usage: oopis-get <sub-command> [options]
      The primary interface for all package management tasks.

      SUB-COMMANDS:
        list               Displays all available packages.
        install <pkg_name> Downloads and installs a package.
        update             Refreshes the local cache of the package manifest.
        remove <pkg_name>  Deletes a package from the system.`,
        });

        this.REPO_URL = "https://raw.githubusercontent.com/aedmark/OopisOS-Packages/refs/heads/main/";
        this.MANIFEST_FILE = "packages.json";
        this.TEMP_MANIFEST_PATH = "/tmp/packages.json";
    }

    /**
     * Executes the core logic for the 'oopis-get' command. It acts as a router,
     * directing execution to the appropriate handler based on the provided sub-command.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, CommandExecutor } = dependencies;
        const subCommand = args[0];

        if (!subCommand) {
            return ErrorHandler.createError({
                message: "oopis-get: missing sub-command.",
                suggestion: "See 'help oopis-get'."
            });
        }

        await CommandExecutor.processSingleCommand("mkdir -p /tmp", { isInteractive: false });

        switch (subCommand.toLowerCase()) {
            case "list":
                return this._handleList(context);
            case "install":
                return this._handleInstall(context);
            case "update":
                return this._handleUpdate(context);
            case "remove":
                return this._handleRemove(context);
            default:
                return ErrorHandler.createError({ message: `oopis-get: unknown sub-command '${subCommand}'.` });
        }
    }

    /**
     * Fetches the remote package manifest, saves it temporarily, and parses it.
     * @private
     * @param {object} dependencies - The system dependencies.
     * @returns {Promise<{manifest?: object, error?: string}>} A promise resolving to an object with the parsed manifest or an error.
     */
    async _fetchAndParseManifest(dependencies) {
        const { CommandExecutor, ErrorHandler } = dependencies;

        const wgetResult = await CommandExecutor.processSingleCommand(
            `wget -O ${this.TEMP_MANIFEST_PATH} ${this.REPO_URL}${this.MANIFEST_FILE}`,
            { isInteractive: false }
        );
        if (!wgetResult.success) {
            return { error: `could not fetch package list. ${wgetResult.error}` };
        }

        const catResult = await CommandExecutor.processSingleCommand(
            `cat ${this.TEMP_MANIFEST_PATH}`,
            { isInteractive: false }
        );
        await CommandExecutor.processSingleCommand(`rm ${this.TEMP_MANIFEST_PATH}`, { isInteractive: false });

        if (!catResult.success) {
            return { error: `could not read package manifest. ${catResult.error}` };
        }

        try {
            const manifest = JSON.parse(catResult.output);
            return { manifest };
        } catch (e) {
            return { error: "failed to parse package manifest." };
        }
    }

    /**
     * Updates the local package manifest file at /etc/pkg_manifest.json to add or remove a package name.
     * @private
     * @param {string} packageName - The name of the package to add or remove.
     * @param {'add'|'remove'} action - The action to perform.
     * @param {object} dependencies - The system dependencies.
     * @returns {Promise<object>} A success or error object from the ErrorHandler.
     */
    async _updatePackageManifest(packageName, action, dependencies) {
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;
        const manifestPath = '/etc/pkg_manifest.json';
        let manifestData;

        const manifestNode = FileSystemManager.getNodeByPath(manifestPath);

        if (manifestNode) {
            try {
                manifestData = JSON.parse(manifestNode.content || '{"packages":[]}');
            } catch (e) {
                return ErrorHandler.createError({ message: "Failed to parse package manifest." });
            }
        } else {
            manifestData = { packages: [] };
        }

        if (action === 'add') {
            if (!manifestData.packages.includes(packageName)) {
                manifestData.packages.push(packageName);
            }
        } else if (action === 'remove') {
            const index = manifestData.packages.indexOf(packageName);
            if (index > -1) {
                manifestData.packages.splice(index, 1);
            }
        }

        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            manifestPath,
            JSON.stringify(manifestData, null, 2),
            { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess();
        } else {
            return ErrorHandler.createError({ message: `Failed to update package manifest: ${saveResult.error}` });
        }
    }

    /**
     * Handles the 'list' sub-command. Fetches and displays all available packages from the repository.
     * @private
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A success or error object from the ErrorHandler.
     */
    async _handleList(context) {
        const { dependencies } = context;
        const { ErrorHandler, OutputManager } = dependencies;

        await OutputManager.appendToOutput("Fetching package list from repository...");

        const result = await this._fetchAndParseManifest(dependencies);
        if (result.error) {
            return ErrorHandler.createError({ message: `oopis-get: ${result.error}` });
        }

        let output = "Available Packages:\n";
        result.manifest.packages.forEach(pkg => {
            output += `  ${pkg.name.padEnd(20)} - ${pkg.description}\n`;
        });
        return ErrorHandler.createSuccess(output);
    }

    /**
     * Handles the 'install' sub-command. Downloads a package, installs it in /bin, and sets permissions.
     * @private
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A success or error object from the ErrorHandler.
     */
    async _handleInstall(context) {
        const { args, dependencies } = context;
        const { CommandExecutor, ErrorHandler, OutputManager } = dependencies;
        const packageName = args[1];

        if (!packageName) {
            return ErrorHandler.createError({ message: "oopis-get: install requires a package name." });
        }

        await OutputManager.appendToOutput(`Attempting to install '${packageName}'...`);

        const result = await this._fetchAndParseManifest(dependencies);
        if (result.error) {
            return ErrorHandler.createError({ message: `oopis-get: ${result.error}` });
        }

        const pkg = result.manifest.packages.find(p => p.name === packageName);
        if (!pkg) {
            return ErrorHandler.createError({ message: `oopis-get: package not found: ${packageName}` });
        }

        const installPath = `/bin/${pkg.name}`;
        const downloadUrl = `${this.REPO_URL}${pkg.path}`;

        await OutputManager.appendToOutput(`Downloading from ${downloadUrl}...`);
        const downloadResult = await CommandExecutor.processSingleCommand(
            `wget -O ${installPath} ${downloadUrl}`,
            { isInteractive: false }
        );

        if (!downloadResult.success) {
            return ErrorHandler.createError({ message: `oopis-get: failed to download package. ${downloadResult.error}` });
        }

        await OutputManager.appendToOutput("Setting permissions...");
        const chmodResult = await CommandExecutor.processSingleCommand(
            `chmod 755 ${installPath}`,
            { isInteractive: false }
        );

        if (!chmodResult.success) {
            return ErrorHandler.createError({ message: `oopis-get: failed to set permissions. ${chmodResult.error}` });
        }

        await this._updatePackageManifest(pkg.name, 'add', dependencies);

        return ErrorHandler.createSuccess(`Successfully installed '${packageName}'. Please reboot the system for the command to become available.`);
    }

    /**
     * Handles the 'update' sub-command. (Currently a placeholder).
     * @private
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A success object from the ErrorHandler.
     */
    async _handleUpdate(context) {
        return context.dependencies.ErrorHandler.createSuccess("Placeholder: update sub-command reached.");
    }

    /**
     * Handles the 'remove' sub-command. Deletes a package file from the /bin directory.
     * @private
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A success or error object from the ErrorHandler.
     */
    async _handleRemove(context) {
        const { args, dependencies } = context;
        const { CommandExecutor, FileSystemManager, ErrorHandler, OutputManager } = dependencies;
        const packageName = args[1];

        if (!packageName) {
            return ErrorHandler.createError({ message: "oopis-get: remove requires a package name." });
        }

        const packagePath = `/bin/${packageName}`;

        const pathValidation = FileSystemManager.validatePath(packagePath, { allowMissing: true });
        if (!pathValidation.data.node) {
            return ErrorHandler.createError({ message: `oopis-get: package '${packageName}' is not installed.` });
        }

        await OutputManager.appendToOutput(`Removing '${packageName}'...`);
        const rmResult = await CommandExecutor.processSingleCommand(
            `rm ${packagePath}`,
            { isInteractive: false }
        );

        if (!rmResult.success) {
            return ErrorHandler.createError({ message: `oopis-get: failed to remove package file. ${rmResult.error}` });
        }

        await this._updatePackageManifest(packageName, 'remove', dependencies);

        return ErrorHandler.createSuccess(`Successfully removed '${packageName}'. Please reboot for the change to take effect.`);
    }
};

window.CommandRegistry.register(new OopisGetCommand());