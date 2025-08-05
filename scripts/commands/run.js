// scripts/commands/run.js

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
      helpText: `Usage: run <script_path>
      Execute a script from a file.
      DESCRIPTION
      The run command reads the specified script file and executes its
      contents line by line as if they were typed into the terminal.
      This is useful for automating repetitive tasks.
      - Lines starting with # are treated as comments and ignored.
      - Blank lines are ignored.
      EXAMPLES
      run setup_project.sh
      Executes the commands listed in the 'setup_project.sh' file.`,
      completionType: "paths",
      validations: {
        args: {
          exact: 1,
          error: "Usage: run <script_path>"
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
   * non-interactive context.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { validatedPaths, dependencies } = context;
    const { CommandExecutor, ErrorHandler, Utils } = dependencies;
    const fileNode = validatedPaths[0].node;

    const scriptContent = fileNode.content || "";
    const lines = scriptContent.split("\n");

    for (const line of lines) {
      const sanitized = Utils.sanitizeForExecution(line, { context: "script" });
      if (!sanitized.isValid) {
        return ErrorHandler.createError({ message: `run: security error in script: ${sanitized.error}` });
      }
    }

    try {
      await CommandExecutor.executeScript(lines, {
        isInteractive: false,
      });
      return ErrorHandler.createSuccess("We did it!");
    } catch (e) {
      return ErrorHandler.createError({ message: `run: ${e.message}` });
    }
  }
}

window.CommandRegistry.register(new RunCommand());