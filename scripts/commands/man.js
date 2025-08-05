// scripts/commands/man.js

/**
 * @fileoverview This file defines the 'man' command, a utility for displaying
 * the manual page for other commands, providing detailed help and usage information.
 * @module commands/man
 */

/**
 * Formats the definition of a command into a standard man page layout.
 * @param {string} commandName - The name of the command.
 * @param {object} commandData - The command's definition object.
 * @returns {string} The formatted man page as a single string.
 */
function formatManPage(commandName, commandData) {
  if (!commandData) {
    return `No manual entry for ${commandName}`;
  }

  const description = commandData.description || "No description available.";
  const helpText = commandData.helpText || "";
  const output = [];

  output.push("NAME");
  output.push(`       ${commandName} - ${description}`);
  output.push("");

  const helpLines = helpText.split("\n");
  const synopsisLine = helpLines.find((line) =>
      line.trim().toLowerCase().startsWith("usage:")
  );
  const synopsis = synopsisLine || `       Usage: ${commandName} [options]`;
  output.push("SYNOPSIS");
  output.push(`       ${synopsis.replace("Usage: ", "")}`);
  output.push("");

  const descriptionText = helpLines
      .slice(synopsisLine ? 1 : 0)
      .join("\n")
      .trim();
  if (descriptionText) {
    output.push("DESCRIPTION");
    descriptionText.split("\n").forEach((line) => {
      output.push(`       ${line}`);
    });
    output.push("");
  }

  if (commandData.flagDefinitions && commandData.flagDefinitions.length > 0) {
    output.push("OPTIONS");
    commandData.flagDefinitions.forEach((flag) => {
      let flagLine = "       ";
      const short = flag.short;
      const long = flag.long;
      let flagIdentifiers = [];
      if (short) flagIdentifiers.push(short);
      if (long) flagIdentifiers.push(long);
      flagLine += flagIdentifiers.join(", ");
      if (flag.takesValue) {
        flagLine += " <value>";
      }
      output.push(flagLine);
    });
    output.push("");
  }

  return output.join("\n");
}

/**
 * Represents the 'man' (manual) command.
 * @class ManCommand
 * @extends Command
 */
window.ManCommand = class ManCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "man",
      description: "Formats and displays the manual page for a command.",
      helpText: `Usage: man <command>
      Displays the manual page for a given command.
      DESCRIPTION
      The man command formats and displays the manual page for a specified
      command. Manual pages include a command's synopsis, a detailed
      description of its function, and a list of its available options.
      EXAMPLES
      man ls
      Displays the comprehensive manual page for the 'ls' command.`,
      completionType: "commands",
      validations: {
        args: {
          exact: 1,
          error: "what manual page do you want?"
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'man' command.
   * It ensures the target command is loaded, retrieves its definition,
   * and then passes it to the formatManPage function to generate the final output.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { args, dependencies } = context;
    const { CommandExecutor, ErrorHandler } = dependencies;
    const commandName = args[0];

    const commandInstance = await CommandExecutor._ensureCommandLoaded(commandName);

    if (!commandInstance) {
      return ErrorHandler.createError({
        message: `No manual entry for ${commandName}`,
        suggestion: "Use 'help' to see a list of available commands.",
      });
    }

    const commandData = commandInstance.definition;

    if (!commandData) {
      return ErrorHandler.createError({ message: `No manual entry for ${commandName}` });
    }

    const manPage = formatManPage(commandName, commandData);

    return ErrorHandler.createSuccess(manPage);
  }
}

window.CommandRegistry.register(new ManCommand());