// scripts/commands/upload.js

/**
 * @fileoverview This file defines the 'upload' command, a utility that allows
 * users to upload files or entire directories from their local machine into the OopisOS virtual file system.
 * @module commands/upload
 */

/**
 * Represents the 'upload' command.
 * @class UploadCommand
 * @extends Command
 */
window.UploadCommand = class UploadCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "upload",
            description: "Uploads files or directories from your local machine to the current OopisOS directory.",
            helpText: `Usage: upload [-d]
      Initiate a file or directory upload from your local machine.

      DESCRIPTION
      The upload command opens your computer's native file selection
      dialog. By default, it allows you to choose one or more files.
      With the -d flag, it allows you to choose a single directory to
      upload recursively.

      Uploaded content will be placed in the current working directory.
      If an item with the same name already exists, you will be prompted
      to confirm the overwrite for that specific item.

      OPTIONS
      -d, --directory
            Upload an entire directory and its contents.

      NOTE: This command is only available in interactive sessions.`,
            validations: {
                args: {
                    exact: 0
                }
            },
            flagDefinitions: [
                { name: "directory", short: "-d", long: "--directory" },
            ]
        });
    }

    /**
     * Executes the core logic of the 'upload' command. It dynamically creates a
     * hidden file input element, triggers a click to open the native file
     * dialog, and then handles the selected files by reading their content and
     * saving them into the virtual file system at the current directory.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { flags, options, currentUser, dependencies } = context;
        const {
            FileSystemManager,
            UserManager,
            OutputManager,
            Config,
            ErrorHandler,
            Utils,
            ModalManager,
        } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError({ message: "upload: Can only be run in interactive mode." });
        }

        const inputAttrs = { type: "file" };
        if (flags.directory) {
            inputAttrs.webkitdirectory = true;
            inputAttrs.mozdirectory = true;
            inputAttrs.directory = true;
        } else {
            inputAttrs.multiple = true;
        }

        const input = Utils.createElement("input", inputAttrs);
        input.style.display = 'none';
        document.body.appendChild(input);

        return new Promise((resolve) => {
            let fileSelected = false;

            const cleanup = () => {
                window.removeEventListener('focus', handleFocus);
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            };

            const handleFocus = () => {
                setTimeout(() => {
                    if (!fileSelected) {
                        cleanup();
                        resolve(ErrorHandler.createSuccess(Config.MESSAGES.UPLOAD_NO_FILE));
                    }
                }, 500);
            };

            window.addEventListener('focus', handleFocus, { once: true });

            input.onchange = async (e) => {
                fileSelected = true;
                const files = e.target.files;

                if (!files || files.length === 0) {
                    cleanup();
                    resolve(ErrorHandler.createSuccess(Config.MESSAGES.UPLOAD_CANCELLED));
                    return;
                }

                let anyFileUploaded = false;
                let errorOccurred = false;
                const currentPath = FileSystemManager.getCurrentPath();

                for (const file of files) {
                    const relativePath = flags.directory ? (file.webkitRelativePath || file.name) : file.name;
                    const newFilePath = `${currentPath === "/" ? "" : currentPath}/${relativePath}`;
                    const existingNode = FileSystemManager.getNodeByPath(newFilePath);

                    if (existingNode) {
                        const confirmed = await new Promise((confirmResolve) => {
                            ModalManager.request({
                                context: "terminal",
                                type: "confirm",
                                messageLines: [`'${relativePath}' already exists. Overwrite it?`],
                                onConfirm: () => confirmResolve(true),
                                onCancel: () => confirmResolve(false),
                                options,
                            });
                        });

                        if (!confirmed) {
                            await OutputManager.appendToOutput(`Skipping '${relativePath}'.`);
                            continue;
                        }
                    }

                    const uploadPromise = new Promise((fileResolve) => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const content = event.target.result;
                            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

                            const saveResult = await FileSystemManager.createOrUpdateFile(
                                newFilePath,
                                content,
                                { currentUser, primaryGroup }
                            );

                            if (saveResult.success) {
                                await OutputManager.appendToOutput(
                                    `${Config.MESSAGES.UPLOAD_SUCCESS_PREFIX}${relativePath}${Config.MESSAGES.UPLOAD_SUCCESS_MIDDLE}${newFilePath}${Config.MESSAGES.UPLOAD_SUCCESS_SUFFIX}`
                                );
                                anyFileUploaded = true;
                                fileResolve(true);
                            } else {
                                await OutputManager.appendToOutput(`Error uploading '${relativePath}': ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                                errorOccurred = true;
                                fileResolve(false);
                            }
                        };
                        reader.onerror = () => {
                            OutputManager.appendToOutput(`Error reading file '${relativePath}'.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                            errorOccurred = true;
                            fileResolve(false);
                        };

                        const stringifiableExtensions = ['txt', 'md', 'html', 'sh', 'js', 'css', 'json', 'xml']; // Whitelist known text-based types
                        const extension = file.name.split('.').pop().toLowerCase();
                        if (!stringifiableExtensions.includes(extension)) {
                            OutputManager.appendToOutput(`Skipping binary or unsupported file '${file.name}': This version of OopisOS only supports text-based file uploads.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                            fileResolve(true); // Resolve as success to continue processing other files
                        } else {
                            reader.readAsText(file);
                        }
                    });
                    await uploadPromise;
                }

                if (anyFileUploaded) {
                    await FileSystemManager.save();
                }

                cleanup();
                if (errorOccurred) {
                    resolve(ErrorHandler.createError({ message: "One or more files failed to upload." }));
                } else {
                    resolve(ErrorHandler.createSuccess("", { stateModified: anyFileUploaded }));
                }
            };
            input.click();
        });
    }
}

window.CommandRegistry.register(new UploadCommand());