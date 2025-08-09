/**
 * @fileoverview
 * Justification: This command is a hybrid. It delegates normal operation to the Python kernel
 * but contains the browser-specific `setInterval` logic for the `--follow` flag.
 */

/**
 * @fileoverview This file defines the 'tail' command, a utility for displaying the
 * last few lines of a file or standard input, with an option to follow file changes.
 * @module commands/tail
 */

/**
 * Represents the 'tail' command for outputting the last part of files.
 * @class TailCommand
 * @extends Command
 */
window.TailCommand = class TailCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "tail",
            description: "Outputs the last part of files.",
            helpText: `Usage: tail [OPTION]... [FILE]...
      Print the last 10 lines of each FILE to standard output.
      With more than one FILE, precede each with a header giving the file name.
      DESCRIPTION
      The tail command displays the end of a text file. It is a useful
      way to see the most recent entries in a log file.
      OPTIONS
      -n, --lines=COUNT
      Output the last COUNT lines, instead of the last 10.
      -f, --follow
      Output appended data as the file grows. This is ignored
      if standard input is a pipe. In OopisOS, this simulates
      watching a file for changes.
      EXAMPLES
      tail /data/logs/system.log
      Displays the last 10 lines of the system log.
      tail -n 100 /data/logs/system.log
      Displays the last 100 lines of the system log.
      tail -f /data/logs/app.log
      Displays the last 10 lines of the app log and continues
      to display new lines as they are added.`,
            isInputStream: true,
            completionType: "paths",
            flagDefinitions: [
                { name: "lines", short: "n", long: "lines", takesValue: true },
                { name: "follow", short: "f", long: "follow" },
            ],
        });
    }

    /**
     * Executes the core logic of the 'tail' command. It processes input from
     * stdin or files and outputs the last N lines. It also handles the '-f'
     * (follow) flag to continuously output new data as a file grows.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { flags, args, signal, dependencies } = context;
        const { ErrorHandler, FileSystemManager, OutputManager, Config } = dependencies;

        // If not following, delegate to the Python kernel.
        if (!flags.follow) {
            // The CommandExecutor will automatically call the Python version if this JS version
            // returns an error indicating the command isn't handled here.
            return ErrorHandler.createError("tail: -f flag not specified; passing to Python kernel.");
        }

        // --- JavaScript-specific '--follow' logic ---
        if (args.length !== 1) {
            return ErrorHandler.createError({ message: "tail: -f option can only be used with a single file argument." });
        }
        const filePath = args[0];
        const pathValidation = await FileSystemManager.validatePath(filePath, {
            expectedType: "file",
            permissions: ["read"],
        });
        if (!pathValidation.success) {
            return ErrorHandler.createError({ message: `tail: ${pathValidation.error}` });
        }

        let lastContent = pathValidation.data.node.content || "";
        const lineCount = flags.lines ? parseInt(flags.lines, 10) : 10;
        const initialLines = lastContent.split("\n").slice(-lineCount);
        await OutputManager.appendToOutput(initialLines.join("\n"));

        const followPromise = new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
                if (signal?.aborted) {
                    clearInterval(checkInterval);
                    resolve(ErrorHandler.createSuccess(""));
                    return;
                }
                const nodeValidation = await FileSystemManager.validatePath(filePath, { expectedType: 'file' });
                if (!nodeValidation.success) {
                    clearInterval(checkInterval);
                    resolve(
                        ErrorHandler.createError({ message: "tail: file deleted or moved" })
                    );
                    return;
                }
                const newContent = nodeValidation.data.node.content || "";
                if (newContent.length > lastContent.length) {
                    const appendedContent = newContent.substring(
                        lastContent.length
                    );
                    void OutputManager.appendToOutput(appendedContent, {suppressNewline: true});
                    lastContent = newContent;
                } else if (newContent.length < lastContent.length) {
                    void OutputManager.appendToOutput(
                        Config.MESSAGES.FILE_TRUNCATED_PREFIX +
                        filePath +
                        Config.MESSAGES.FILE_TRUNCATED_SUFFIX
                    );
                    const newLines = newContent.split("\n").slice(-lineCount);
                    void OutputManager.appendToOutput(newLines.join("\n"));
                    lastContent = newContent;
                }
            }, 1000);

            signal?.addEventListener('abort', () => {
                clearInterval(checkInterval);
                resolve(ErrorHandler.createSuccess(""));
            });
        });

        return await followPromise;
    }
}

window.CommandRegistry.register(new TailCommand());