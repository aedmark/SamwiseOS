// gem/scripts/commands/upload.js

/**
 * @fileoverview
 * Justification: This command is a specialist that uses the browser's file input dialog.
 * It orchestrates the entire upload flow, from user interaction to calling the
 * internal Python handler.
 */
window.UploadCommand = class UploadCommand extends Command {
    constructor() {
        super({
            commandName: "upload",
            description: "Uploads files from your local machine to SamwiseOS.",
            helpText: `Usage: upload
      Initiates a file upload from your local machine to the current directory
      by opening the browser's native file selection dialog. It provides a
      status report for each selected file. If a file with the same name
      already exists, it will ask for confirmation before overwriting.`,
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { FileSystemManager, ModalManager, UserManager, ErrorHandler, Utils, CommandExecutor } = dependencies;

        return new Promise(async (resolve) => {
            const input = Utils.createElement("input", { type: "file", multiple: true });
            input.style.display = 'none';
            document.body.appendChild(input);

            const onFocus = () => {
                setTimeout(() => {
                    if (input.files.length === 0) {
                        if (document.body.contains(input)) document.body.removeChild(input);
                        resolve(ErrorHandler.createSuccess("Upload cancelled."));
                    }
                    window.removeEventListener('focus', onFocus);
                }, 500);
            };

            input.onchange = async (e) => {
                window.removeEventListener('focus', onFocus);
                const files = e.target.files;
                if (document.body.contains(input)) document.body.removeChild(input);
                if (!files || files.length === 0) {
                    resolve(ErrorHandler.createSuccess("Upload cancelled."));
                    return;
                }

                const filesToProcess = [];
                const skippedFiles = [];

                for (const file of Array.from(files)) {
                    const targetPath = FileSystemManager.getAbsolutePath(file.name);
                    const existingNode = await FileSystemManager.getNodeByPath(targetPath);

                    if (existingNode) {
                        const confirmed = await new Promise(r => {
                            ModalManager.request({
                                context: 'terminal',
                                type: 'confirm',
                                messageLines: [`File '${file.name}' already exists in ${FileSystemManager.getCurrentPath()}. Overwrite?`],
                                onConfirm: () => r(true),
                                onCancel: () => r(false),
                                options: context.options,
                            });
                        });

                        if (confirmed) {
                            filesToProcess.push(file);
                        } else {
                            skippedFiles.push(file.name);
                        }
                    } else {
                        filesToProcess.push(file);
                    }
                }

                if (filesToProcess.length === 0) {
                    let output = "No files were uploaded.";
                    if (skippedFiles.length > 0) {
                        output += ` Skipped overwriting: ${skippedFiles.join(', ')}.`;
                    }
                    resolve(ErrorHandler.createSuccess(output));
                    return;
                }

                const fileDataPromises = filesToProcess.map(file => {
                    return new Promise((res, rej) => {
                        const reader = new FileReader();
                        reader.onload = (event) => res({
                            name: file.name,
                            path: FileSystemManager.getAbsolutePath(file.name),
                            content: event.target.result
                        });
                        reader.onerror = () => rej(new Error(`Could not read file: ${file.name}`));
                        reader.readAsText(file);
                    });
                });

                try {
                    const filesForPython = await Promise.all(fileDataPromises);
                    const user = UserManager.getCurrentUser();
                    const primaryGroup = UserManager.getPrimaryGroupForUser(user.name);
                    const userContext = { name: user.name, group: primaryGroup };

                    const kernelContextJson = CommandExecutor.createKernelContext();

                    const resultJson = OopisOS_Kernel.syscall("executor", "run_command_by_name", [], {
                        command_name: '_upload_handler',
                        args: [],
                        flags: {},
                        user_context: userContext,
                        stdin_data: null,
                        kwargs: { files: filesForPython },
                        js_context_json: kernelContextJson
                    });

                    const pyResult = JSON.parse(resultJson);

                    if (pyResult.success) {
                        let finalMessage = pyResult.output || "";
                        if (skippedFiles.length > 0) {
                            const skippedMessage = `Skipped overwriting: ${skippedFiles.join(', ')}.`;
                            finalMessage = finalMessage ? `${finalMessage}\n${skippedMessage}` : skippedMessage;
                        }
                        resolve(ErrorHandler.createSuccess(finalMessage));
                    } else {
                        resolve(ErrorHandler.createError(pyResult.error || "An unknown error occurred during upload."));
                    }
                } catch(err) {
                    resolve(ErrorHandler.createError(`File read error: ${err.message}`));
                }
            };

            window.addEventListener('focus', onFocus);
            input.click();
        });
    }
};

window.CommandRegistry.register(new UploadCommand());