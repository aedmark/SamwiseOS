// scripts/commands/help.js

/**
 * @fileoverview This file defines the 'help' command, a utility for displaying
 * a list of all available commands or the syntax for a specific command.
 * @module commands/help
 */

/**
 * Represents the 'help' command.
 * @class HelpCommand
 * @extends Command
 */
window.HelpCommand = class HelpCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "help",
      description: "Displays a list of commands or a command's syntax.",
      helpText: `Usage: help [command]
      Displays a list of all available commands.
      If a command name is provided, it displays the command's usage syntax.
      For a full, detailed manual page for a command, use 'man <command>'.`,
      completionType: "commands",
      validations: {
        args: {
          max: 1
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'help' command.
   * If no arguments are provided, it lists all available commands with their descriptions.
   * If a command name is given, it displays the specific usage syntax for that command.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {

    const { args, dependencies } = context;
    const { Config, CommandExecutor, CommandRegistry, ErrorHandler } = dependencies;

    try {
      if (args.length === 0) {
        const allCommandNames = Config.COMMANDS_MANIFEST.sort();
        const loadedCommands = CommandRegistry.getCommands();

        let output = "OopisOS Help\n\nAvailable commands:\n";
        allCommandNames.forEach((cmdName) => {
          const commandInstance = loadedCommands[cmdName];
          const description = commandInstance?.definition?.description || "";
          output += `  ${cmdName.padEnd(15)} ${description}\n`;
        });
        output +=
            "\nType 'help [command]' or 'man [command]' for more details.";
        return ErrorHandler.createSuccess(output);
      } else {
        const cmdName = args[0].toLowerCase();
        const commandInstance = await CommandExecutor._ensureCommandLoaded(cmdName);

        if (!commandInstance) {
          return ErrorHandler.createError({
            message: `help: command not found: ${cmdName}`
          });
        }

        let output = "";

        if (commandInstance?.definition?.helpText) {
          const helpLines = commandInstance.definition.helpText.split("\n");
          const usageLine = helpLines.find((line) =>
              line.trim().toLowerCase().startsWith("usage:")
          );
          if (usageLine) {
            output = usageLine.trim();
          } else {
            output = `Synopsis for '${cmdName}':\n  ${commandInstance.definition.description || "No usage information available."}`;
          }
          output += `\n\nFor more details, run 'man ${cmdName}'`;
        } else {
          return ErrorHandler.createError({
            message: `help: command not found: ${args[0]}`
          });
        }
        return ErrorHandler.createSuccess(output);
      }
    } catch (e) {
      return ErrorHandler.createError({
        message: `help: An unexpected error occurred: ${e.message}`
      });
    }
  }
}

window.CommandRegistry.register(new HelpCommand());