// scripts/commands/less.js

/**
 * @fileoverview This file defines the 'less' command, a pager utility for
 * displaying content from files or standard input with backward and forward scrolling.
 * @module commands/less
 */

/**
 * Represents the 'less' command, an improved pager for displaying content.
 * @class LessCommand
 * @extends Command
 */
window.LessCommand = class LessCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "less",
            dependencies: [],
            description: "An improved pager for displaying content.",
            helpText: `Usage: less [file]
      Displays file content or standard input one screen at a time.
      DESCRIPTION
      less is a program similar to 'more', but it allows backward
      movement in the file as well as forward movement. When used in a
      non-interactive script, it prints the entire input without pausing.
      CONTROLS
      SPACE / f:   Page forward.
      b / ArrowUp:   Page backward.
      ArrowDown:   Scroll down one line.
      q:           Quit.
      EXAMPLES
      less very_long_document.txt
      Displays the document and allows scrolling in both directions.`,
            isInputStream: true,
            completionType: "paths",
        });
    }

    /**
     * Executes the core logic of the 'less' command.
     * It reads content from files or standard input and, if in an interactive session,
     * opens the PagerManager to display the content. Otherwise, it prints the entire
     * content to standard output.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { options, inputItems, inputError, dependencies } = context;
        const { ErrorHandler, PagerManager } = dependencies;

        if (inputError) {
            return ErrorHandler.createError({
                message: "less: Could not read one or more sources."
            });
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\\n");

        if (!options.isInteractive) {
            return ErrorHandler.createSuccess(content);
        }

        await PagerManager.enter(content, { mode: "less" });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new LessCommand());