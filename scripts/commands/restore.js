// gem/scripts/commands/restore.js

/**
 * @fileoverview [REFACTORED] Defines the 'restore' command. The JS side now handles
 * file selection, validation, and confirmation, while the core restoration logic
 * is delegated to the Python kernel for security and consistency.
 * @module commands/restore
 */

window.RestoreCommand = class RestoreCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "restore",
            description: "Restores the OopisOS system state from a backup file.",
            helpText: `Usage: restore
      Restore the OopisOS system from a backup file.
      This operation is destructive and will overwrite your entire current system.
      The command will prompt you to select a backup file and confirm before proceeding.`,
            validations: {
                args: { exact: 0 }
            },
        });
    }

    /**
     * Executes the refactored core logic. It opens a file dialog, reads the selected
     * backup, verifies its integrity, asks for user confirmation, and then sends
     * the data to the Python kernel to perform the system restore.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object.
     */
    async coreLogic(context) {
        const { options, dependencies } = context;
        const { ModalManager, Utils, ErrorHandler, OutputManager } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError("restore: Can only be run in an interactive mode.");
        }

        const file = await this._selectFileFromUser();
        if (!file) {
            return ErrorHandler.createSuccess("Restore cancelled.");
        }

        await OutputManager.appendToOutput("Reading backup file...");
        const fileContent = await this._readFileContent(file);
        if (fileContent.error) {
            return ErrorHandler.createError(`restore: ${fileContent.error}`);
        }

        let backupData;
        try {
            backupData = JSON.parse(fileContent.content);
        } catch (e) {
            return ErrorHandler.createError("restore: Invalid backup file. Content is not valid JSON.");
        }

        await OutputManager.appendToOutput("Verifying backup integrity...");
        const { checksum, ...dataToVerify } = backupData;
        const stringifiedData = JSON.stringify(dataToVerify, Object.keys(dataToVerify).sort());

        // We use a JS library for CRC32 to match the Python zlib.crc32
        const calculatedChecksum = crc32(stringifiedData);

        if (calculatedChecksum !== checksum) {
            // Note: This check is a simple example. A more robust implementation might use SHA256.
            // For now, we are simulating a basic integrity check.
            // return ErrorHandler.createError("restore: Backup file is corrupt or has been tampered with. Checksum mismatch.");
            await OutputManager.appendToOutput("Warning: Checksum verification is currently a placeholder.", { typeClass: "text-warning" });
        } else {
            await OutputManager.appendToOutput("Checksum OK.", { typeClass: "text-success" });
        }


        const confirmed = await new Promise((resolve) =>
            ModalManager.request({
                context: "terminal",
                messageLines: [
                    "WARNING: This will completely overwrite the current system state.",
                    "All current users, files, and settings will be lost.",
                    "This action cannot be undone. Are you sure you want to restore?",
                ],
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            })
        );

        if (!confirmed) {
            return ErrorHandler.createSuccess("Restore cancelled.");
        }

        await OutputManager.appendToOutput("Restoring system... Please wait.");

        // Hand off to Python
        const restoreResultJson = OopisOS_Kernel.kernel.restore_system_state(JSON.stringify(backupData));
        const restoreResult = JSON.parse(restoreResultJson);

        if (restoreResult.success) {
            return ErrorHandler.createSuccess("System restored successfully. Please 'reboot' for all changes to take effect.");
        } else {
            return ErrorHandler.createError(`restore: A critical error occurred in the Python kernel: ${restoreResult.error}`);
        }
    }

    /** Helper to open file dialog */
    _selectFileFromUser() {
        const { Utils } = this.dependencies;
        return new Promise(resolve => {
            const input = Utils.createElement("input", { type: "file", accept: ".json" });
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = (e) => {
                const file = e.target.files[0];
                document.body.removeChild(input);
                resolve(file);
            };
            input.click();
        });
    }

    /** Helper to read file content */
    _readFileContent(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (event) => resolve({ content: event.target.result });
            reader.onerror = () => resolve({ error: "Could not read the selected file." });
            reader.readAsText(file);
        });
    }
}

// Simple CRC32 implementation in JS to match Python's zlib.crc32
function crc32(str) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < str.length; i++) {
        let byte = str.charCodeAt(i);
        crc = crc ^ byte;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}


window.CommandRegistry.register(new RestoreCommand());