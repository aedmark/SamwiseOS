/**
 * @fileoverview This file defines the 'sed' command, a stream editor for
 * filtering and transforming text from standard input or files.
 * @module commands/sed
 */

/**
 * Represents the 'sed' (stream editor) command.
 * @class SedCommand
 * @extends Command
 */
window.SedCommand = class SedCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "sed",
            description: "Stream editor for filtering and transforming text.",
            helpText: `Usage: sed <script> [file...]
      A stream editor for text transformation.
      DESCRIPTION
      The sed (stream editor) command filters and transforms text from
      an input stream (a file or a pipe). It reads the input line by line,
      applies a script to each line, and then outputs the modified line.
      This version supports the basic substitution command:
      s/regexp/replacement/flags
      The only supported flag is 'g' for global (all occurrences on a line)
      replacement.
      EXAMPLES
      echo "hello world" | sed 's/world/OopisOS/'
      Prints "hello OopisOS".
      cat file.txt | sed 's/error/warning/g'
      Replaces all occurrences of "error" with "warning" in file.txt.`,
            isInputStream: true,
            completionType: "paths"
        });
    }

    /**
     * Executes the core logic of the 'sed' command. It parses a substitution
     * script from the arguments, creates a regular expression from it, and
     * applies the transformation to each line of the input content.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError({ message: "sed: No readable input or permission denied." });
        }
        if (args.length === 0) {
            return ErrorHandler.createError({ message: "sed: no script specified." });
        }

        const script = args[0];
        const substitutionRegex = /^s\/(.+?)\/(.*?)\/([g]?)$/;
        const match = script.match(substitutionRegex);

        if (!match) {
            return ErrorHandler.createError({ message: `sed: invalid script: ${script}` });
        }

        const [, pattern, replacement, flags] = match;
        const regex = new RegExp(pattern, flags);

        const content = (inputItems || []).map(item => item.content).join('\n');
        const lines = content.split('\n');
        const transformedLines = lines.map(line => line.replace(regex, replacement));

        return ErrorHandler.createSuccess(transformedLines.join('\n'));
    }
};

window.CommandRegistry.register(new SedCommand());