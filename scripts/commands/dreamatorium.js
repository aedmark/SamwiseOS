// gem/scripts/commands/dreamatorium.js

/**
 * @fileoverview This file defines the 'dreamatorium' command, a utility for entering a sandboxed
 * session where filesystem changes are temporary and discarded upon exit.
 * @module commands/dreamatorium
 */

/**
 * Represents the 'dreamatorium' command for entering a sandboxed session.
 * @class DreamatoriumCommand
 * @extends Command
 */
window.DreamatoriumCommand = class DreamatoriumCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "dreamatorium",
            description: "Enters a sandboxed session where commands do not affect the main filesystem.",
            helpText: `Usage: dreamatorium

      DESCRIPTION
            The dreamatorium command initiates a temporary, isolated session.
            All filesystem operations (create, modify, delete) performed inside
            the Dreamatorium are sandboxed and will be discarded upon exit.
            This allows for safe testing of scripts and commands without any
            risk to your actual files.

            To exit the Dreamatorium, simply use the 'exit' command.

      EXAMPLES
            dreamatorium
            (You are now in the Dreamatorium)
            dreamatorium:/home/Guest> touch a_file_that_is_not_real.txt
            dreamatorium:/home/Guest> ls
            a_file_that_is_not_real.txt
            dreamatorium:/home/Guest> exit
            (You are back in reality)
            /home/Guest> ls
            (a_file_that_is_not_real.txt is gone, because it was never real)`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'dreamatorium' command.
     * This function saves the current state of the filesystem and session, creates a
     * deep copy for the sandboxed environment, changes the prompt, and sets up a
     * special exit handler on the CommandExecutor to restore the original state
     * when the user types 'exit'.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { options, dependencies } = context;
        const { FileSystemManager, SessionManager, OutputManager, TerminalUI, ErrorHandler, CommandExecutor, SoundManager, AppLayerManager } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError({
                message: "dreamatorium: Can only be run in an interactive session."
            });
        }

        await OutputManager.appendToOutput("Initializing Dreamatorium... Reality is on hold.", { typeClass: "text-success" });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Storing the real state
        const realFsData = FileSystemManager.getFsData();
        const realSessionState = {
            history: dependencies.HistoryManager.getFullHistory(),
            aliases: dependencies.AliasManager.getAllAliases(),
            environment: dependencies.EnvironmentManager.getAll()
        };

        // This is where the magic happens. A deep copy for our sandbox.
        const dreamatoriumFsData = JSON.parse(JSON.stringify(realFsData));
        FileSystemManager.setFsData(dreamatoriumFsData);

        const originalPS1 = dependencies.EnvironmentManager.get("PS1") || 'default';
        dependencies.EnvironmentManager.set("PS1", `dreamatorium:\\w\\$ `);
        TerminalUI.updatePrompt();

        // Dreamatorium loop logic will be handled by intercepting the 'exit' command
        // We'll use a custom property on the CommandExecutor to manage this state
        CommandExecutor.isInDreamatorium = true;
        CommandExecutor.dreamatoriumExitHandler = async () => {
            // Restore the real state
            FileSystemManager.setFsData(realFsData);
            dependencies.HistoryManager.setHistory(realSessionState.history);
            dependencies.AliasManager.aliases = realSessionState.aliases;
            dependencies.EnvironmentManager.load(realSessionState.environment);

            if (originalPS1 === 'default') {
                dependencies.EnvironmentManager.unset("PS1");
            } else {
                dependencies.EnvironmentManager.set("PS1", originalPS1);
            }

            await OutputManager.appendToOutput("\nDeactivating Dreamatorium. Welcome back to reality.", { typeClass: "text-success" });
            SoundManager.beep(); // The non-negotiable "bwoop"!
            TerminalUI.updatePrompt();

            // Cleanup the special state
            CommandExecutor.isInDreamatorium = false;
            delete CommandExecutor.dreamatoriumExitHandler;
        };

        return ErrorHandler.createSuccess("", { suppressNewline: true });
    }
}

window.CommandRegistry.register(new DreamatoriumCommand());