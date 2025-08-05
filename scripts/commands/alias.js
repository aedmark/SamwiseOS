/**
 * @file /scripts/commands/alias.js
 * @description The 'alias' command, used for creating, displaying, and managing command shortcuts.
 */

/**
 * Represents the 'alias' command which allows users to define or display command aliases.
 * @class AliasCommand
 * @extends Command
 */
window.AliasCommand = class AliasCommand extends Command {
  /**
   * @constructor
   * @description Initializes the command's definition.
   */
  constructor() {
    super({
      commandName: "alias",
      description: "Create, remove, and display command aliases.",
      helpText: `Usage: alias [name='command']...

Define or display command aliases.

DESCRIPTION
       The alias command allows you to create shortcuts for longer or more
       complex commands. Aliases are saved and persist across sessions.

       Running \`alias\` with no arguments lists all currently defined
       aliases in a reusable format.

       To create or redefine an alias, use the \`name='command'\` format.
       The command string should be quoted if it contains spaces or
       special characters.

       To display a specific alias, run \`alias <name>\`.

EXAMPLES
       alias ll='ls -la'
              Creates a shortcut 'll' for a long directory listing.

       alias mypath='echo $PATH'
              Creates an alias to display the current PATH variable.
       
       alias
              Lists all defined aliases.
       
       alias ll
              Displays the definition for the 'll' alias.`,
    });
  }

  /**
   * Main logic for the 'alias' command.
   * Handles three cases:
   * 1. No arguments: Lists all defined aliases.
   * 2. One argument: Displays the definition for a specific alias.
   * 3. Key-value pair: Creates or updates an alias.
   * @param {object} context - The command execution context.
   * @param {Array<string>} context.args - The arguments passed to the command.
   * @param {object} context.dependencies - The system dependencies.
   * @returns {Promise<object>} The result of the command execution.
   */
  async coreLogic(context) {
    const { args, dependencies } = context;
    const { AliasManager, ErrorHandler, Utils } = dependencies;

    if (args.length === 0) {
      const allAliases = AliasManager.getAllAliases();
      if (Object.keys(allAliases).length === 0) {
        return ErrorHandler.createSuccess("");
      }
      const outputLines = [];
      for (const name in allAliases) {
        const value = allAliases[name];
        outputLines.push(`alias ${name}='${value}'`);
      }
      return ErrorHandler.createSuccess(outputLines.sort().join("\n"));
    }

    const { name, value } = Utils.parseKeyValue(args);

    if (value !== null) {
      // Set an alias
      if (!name) {
        return ErrorHandler.createError(
            "alias: invalid format. Missing name."
        );
      }
      if (AliasManager.setAlias(name, value)) {
        return ErrorHandler.createSuccess("", { stateModified: true });
      }
      return ErrorHandler.createError("alias: failed to set alias.");
    } else {
      // Get a specific alias
      const aliasValue = AliasManager.getAlias(name);
      if (aliasValue) {
        return ErrorHandler.createSuccess(`alias ${name}='${aliasValue}'`);
      } else {
        return ErrorHandler.createError(`alias: ${name}: not found`);
      }
    }
  }
}

window.CommandRegistry.register(new AliasCommand());