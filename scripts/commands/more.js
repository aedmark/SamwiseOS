// scripts/commands/more.js

/**
 * @fileoverview This file defines the 'more' command, a simple pager utility
 * for displaying content from files or standard input one screen at a time.
 * @module commands/more
 */

/**
 * Represents the 'more' command, a pager for displaying content.
 * @class MoreCommand
 * @extends Command
 */
window.MoreCommand = class MoreCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "more",
            dependencies: [],
            description: "A simple pager for displaying content.",
            helpText: `Usage: more [file]
      Displays file content or standard input one screen at a time.
      DESCRIPTION
      The more command is a filter for paging through text one screenful
      at a time. It only allows forward movement. For more advanced
      features like backward scrolling, use 'less'.
      When used in a non-interactive script, it prints the entire
      input without pausing.
      CONTROLS
      SPACE / f:   Page forward.
      q:           Quit.
      EXAMPLES
      more long_document.txt
      Displays the document, pausing after each screenful of text.`,
            isInputStream: true,
            completionType: "paths",
        });
    }

    /**
     * Executes the core logic of the 'more' command.
     * It takes content from files or standard input and either prints it all at once
     * (in non-interactive mode) or opens the PagerManager to display it screen by screen.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { options, inputItems, inputError, dependencies } = context;
        const { ErrorHandler, PagerManager } = dependencies;

        if (inputError) {
            return ErrorHandler.createError({
                message: "more: Could not read one or more sources."
            });
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");

        if (!options.isInteractive) {
            return ErrorHandler.createSuccess(content);
        }

        await PagerManager.enter(content, { mode: "more" });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new MoreCommand());