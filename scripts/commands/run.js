// scripts/commands/run.js

/**
 * @fileoverview
 * Justification: This command is deeply integrated with the JavaScript CommandExecutor's execution loop.
 */

/**
 * @fileoverview This file defines the 'run' command, a utility for executing
 * a script file containing a sequence of OopisOS shell commands.
 * @module commands/run
 */

/**
 * Represents the 'run' command for executing script files.
 * @class RunCommand
 * @extends Command
 */
window.RunCommand = class RunCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "run",
            description: "Executes a script file as a series of commands.",
            helpText: `Usage: run <script_path> [args...]
      Execute a script from a file.
      DESCRIPTION
      The run command reads the specified script file and executes its
      contents line by line. Arguments can be passed to the script
      and accessed via $1, $2, $#, etc.
      - Lines starting with # are treated as comments and ignored.
      - Blank lines are ignored.
      - Special handling for 'useradd' and 'sudo' allows for non-interactive
        password input on subsequent lines.
      EXAMPLES
      run setup_project.sh
      run my_script.sh "first arg" "second arg"`,
            completionType: "paths",
            validations: {
                args: {
                    min: 1, // At least one argument (the script path) is required
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read', 'execute']
                    }
                }]
            },
        });
    }

    /**
     * Executes the core logic of the 'run' command. It reads the content of the
     * specified script file, sanitizes each line for basic security, and then
     * passes the lines to the CommandExecutor to be executed sequentially in a
     * non-interactive context. It now includes logic to handle non-interactive
     * password inputs for specific commands.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, validatedPaths, dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;
        const fileNode = validatedPaths[0].node;
        const scriptArgs = args.slice(1);

        const scriptContent = fileNode.content || "";
        const lines = scriptContent.split("\n");

        const commandObjects = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const strippedLine = line.trim();

            if (!strippedLine || strippedLine.startsWith('#')) {
                i++;
                continue;
            }

            let passwordLinesNeeded = 0;
            if (strippedLine.startsWith("useradd")) passwordLinesNeeded = 2;
            else if (strippedLine.startsWith("sudo")) passwordLinesNeeded = 1;

            if (passwordLinesNeeded > 0) {
                const passwordPipe = [];
                let lookaheadIndex = i + 1;
                let linesConsumed = 0;
                while (lookaheadIndex < lines.length && passwordPipe.length < passwordLinesNeeded) {
                    const nextLine = lines[lookaheadIndex];
                    linesConsumed++;
                    if (nextLine.trim() && !nextLine.trim().startsWith('#')) {
                        passwordPipe.push(nextLine);
                    }
                    lookaheadIndex++;
                }

                const commandObj = {
                    command: line,
                    password_pipe: passwordPipe.length === passwordLinesNeeded ? passwordPipe : null
                };
                commandObjects.push(commandObj);
                i += 1 + linesConsumed;
            } else {
                commandObjects.push({ command: line });
                i++;
            }
        }

        try {
            await CommandExecutor.executeScript(commandObjects, {
                isInteractive: false,
                args: scriptArgs,
            });
            return ErrorHandler.createSuccess("");
        } catch (e) {
            return ErrorHandler.createError(`run: ${e.message}`);
        }
    }
}

window.CommandRegistry.register(new RunCommand());