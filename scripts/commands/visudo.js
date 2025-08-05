/**
 * @fileoverview This file defines the 'visudo' command, a secure utility for
 * editing the /etc/sudoers file, ensuring syntax validity before saving.
 * @module commands/visudo
 */

/**
 * Represents the 'visudo' command, a safe editor for the sudoers file.
 * @class VisudoCommand
 * @extends Command
 */
window.VisudoCommand = class VisudoCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "visudo",
            description: "Edits the sudoers file with syntax checking.",
            helpText: `Usage: visudo
      Edit the sudoers file.
      DESCRIPTION
      visudo edits the sudoers file in a safe fashion. It opens the
      /etc/sudoers file in the 'edit' application. Upon saving, visudo
      parses the file to check for syntax errors before installing it.
      If errors are found, the changes are not saved, and the user is

      prompted to re-edit or quit.
      This prevents syntax errors in the sudoers file from locking users
      out of the 'sudo' command.
      PERMISSIONS
      Only the superuser (root) can run this command.`,
            dependencies: [
                "apps/editor/editor_ui.js",
                "apps/editor/editor_manager.js",
            ],
            applicationModules: ["EditorManager", "EditorUI", "App"],
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'visudo' command. It ensures the user is
     * root, then launches the 'edit' application with a special post-save hook.
     * This hook intercepts the save event, validates the new content's syntax
     * using the SudoManager, and only allows the save to complete if the syntax is valid.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with the result of the 'edit' command execution.
     */
    async coreLogic(context) {
        const { currentUser, options, dependencies } = context;
        const {
            FileSystemManager,
            SudoManager,
            CommandExecutor,
            ErrorHandler,
        } = dependencies;

        if (currentUser !== "root") {
            return ErrorHandler.createError({
                message: "sorry, you must be root to run this command.",
                suggestion: "Try running this command with 'sudo'.",
            });
        }

        if (!options.isInteractive) {
            return ErrorHandler.createError({ message: "visudo: Can only be run in an interactive mode." });
        }

        const sudoersPath = SudoManager.config.SUDO.SUDOERS_PATH;
        let originalContent = "";
        const sudoersNode = FileSystemManager.getNodeByPath(sudoersPath);
        if (sudoersNode) {
            originalContent = sudoersNode.content || "";
        }

        options.postSaveHook = async (newContent) => {
            const { isValid, error } = SudoManager.parseSudoers(newContent);
            if (isValid) {
                return { success: true, message: "sudoers file updated." };
            } else {
                const reEditCallback = async (editorInstance) => {
                    editorInstance.setContent(originalContent);
                    editorInstance.ui.showToast(
                        `Syntax error: ${error}. Reverting changes.`,
                        "error"
                    );
                };

                return {
                    success: false,
                    message: `visudo: >>> sudoers file syntax error <<<`,
                    error: `${error}\nChanges not saved.`,
                    reEditCallback,
                };
            }
        };

        return CommandExecutor.processSingleCommand(`edit ${sudoersPath}`, options);
    }
}

window.CommandRegistry.register(new VisudoCommand());