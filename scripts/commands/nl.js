// scripts/commands/nl.js

/**
 * @fileoverview This file defines the 'nl' command, a utility for numbering
 * the lines of files or standard input.
 * @module commands/nl
 */

/**
 * Represents the 'nl' (number lines) command.
 * @class NlCommand
 * @extends Command
 */
window.NlCommand = class NlCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "nl",
            description: "Numbers lines of files.",
            helpText: `Usage: nl [FILE]...
      Write each FILE to standard output, with line numbers added.
      DESCRIPTION
      The nl (number lines) utility reads lines from files or standard
      input and adds line numbers to all non-empty lines. Blank lines
      are preserved but not numbered.
      With no FILE, or when FILE is -, it reads from standard input.
      EXAMPLES
      nl document.txt
      Displays the content of document.txt with non-empty lines numbered.
      ls | nl
      Displays the contents of the current directory, with each
      item on a numbered line.`,
            isInputStream: true,
            completionType: "paths"
        });
    }

    /**
     * Executes the core logic of the 'nl' command.
     * It reads content from files or standard input, iterates through each line,
     * and prepends a formatted line number to all non-empty lines.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError({ message: "nl: No readable input provided or permission denied." });
        }
        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");
        const lines = content.split('\n');
        let lineNumber = 1;
        const outputLines = lines.map(line => {
            if (line.trim() !== '') {
                return `     ${String(lineNumber++).padStart(5)}  ${line}`;
            }
            return `       ${line}`;
        });

        return ErrorHandler.createSuccess(outputLines.join('\n'));
    }
};

window.CommandRegistry.register(new NlCommand());