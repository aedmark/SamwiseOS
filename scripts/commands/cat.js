/**
 * @file scripts/commands/cat.js
 * @description The 'cat' command, which concatenates and displays the content of files or standard input.
 * It supports numbering output lines.
 */

/**
 * Represents the 'cat' (concatenate) command. It can read from files or standard input
 * and print the content to standard output, optionally with line numbers.
 * @class CatCommand
 * @extends Command
 */
window.CatCommand = class CatCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "cat",
            description: "Concatenate and display the content of files.",
            helpText: `Usage: cat [OPTION]... [FILE]...
      Concatenate and print files to the standard output.
      DESCRIPTION
      The cat utility reads files sequentially, writing them to the standard
      output. The file operands are processed in command-line order.
      If no files are specified, cat reads from standard input. This makes
      it useful in pipelines for displaying the output of other commands.
      OPTIONS
      -n, --number
      Number all output lines, starting from 1.
      EXAMPLES
      cat file1.txt
      Displays the content of file1.txt.
      cat file1.txt file2.txt > newfile.txt
      Concatenates file1.txt and file2.txt and writes the
      result to newfile.txt.
      ls -l | cat
      Displays the output of the 'ls -l' command, demonstrating
      how cat handles piped input.`,
            completionType: "paths",
            isInputStream: true,
            flagDefinitions: [{ name: "numberLines", short: "-n", long: "--number" }],
        });
    }

    /**
     * Main logic for the 'cat' command.
     * It processes input from files or stdin, concatenates them, and optionally numbers the lines.
     * @param {object} context - The command execution context.
     * @param {object} context.flags - The parsed command-line flags.
     * @param {Array<object>} context.inputItems - The content read from the input stream.
     * @param {boolean} context.inputError - A flag indicating if there was an error reading the input.
     * @param {object} context.dependencies - System dependencies.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;
        if (inputError) {
            return ErrorHandler.createError(
                "cat: One or more files could not be read."
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");

        if (flags.numberLines) {
            let lineCounter = 1;
            const lines = content.split("\n");
            // If the last line is empty, it's a trailing newline, so don't number it.
            const processedLines =
                lines.length > 0 && lines[lines.length - 1] === ""
                    ? lines.slice(0, -1)
                    : lines;
            const numberedOutput = processedLines
                .map((line) => `     ${String(lineCounter++).padStart(5)}  ${line}`)
                .join("\n");
            return ErrorHandler.createSuccess(numberedOutput);
        }

        return ErrorHandler.createSuccess(content);
    }
}

window.CommandRegistry.register(new CatCommand());