// gem/scripts/commands/upload.js

/**
 * @fileoverview [REFACTORED] This file defines the 'upload' command. The JavaScript
 * side is now responsible only for handling the browser's file dialog. The actual
 * file writing and validation is delegated to the Python kernel.
 * @module commands/upload
 */

window.UploadCommand = class UploadCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "upload",
            description: "Uploads files from your local machine to OopisOS.",
            helpText: `Usage: upload
      Initiate a file upload from your local machine to the current directory.
      This command is only available in interactive sessions.`,
            validations: {
                args: { exact: 0 }
            },
        });
    }

    /**
     * Executes the refactored core logic of the 'upload' command. It creates a
     * file input element to trigger the browser's file selection dialog.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves when the user has selected files.
     */
    async coreLogic(context) {
        const { options, dependencies } = context;
        const { ErrorHandler, Utils } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError({ message: "upload: Can only be run in interactive mode." });
        }

        const input = Utils.createElement("input", { type: "file", multiple: true });
        input.style.display = 'none';
        document.body.appendChild(input);

        return new Promise((resolve) => {
            input.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) {
                    resolve(ErrorHandler.createSuccess("Upload cancelled."));
                    return;
                }
                // The actual file handling is now an "effect" triggered by the result.
                resolve(ErrorHandler.createSuccess("File selection complete. Processing upload...", {
                    effect: "upload_files",
                    files: Array.from(files) // Pass FileList to be handled by commexec
                }));
                document.body.removeChild(input);
            };

            // Handle cancellation of the file dialog
            window.addEventListener('focus', () => {
                setTimeout(() => {
                    if (input.files.length === 0) {
                        resolve(ErrorHandler.createSuccess("Upload cancelled."));
                        if (document.body.contains(input)) {
                            document.body.removeChild(input);
                        }
                    }
                }, 500);
            }, { once: true });

            input.click();
        });
    }
}

window.CommandRegistry.register(new UploadCommand());