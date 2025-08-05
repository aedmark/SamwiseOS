// scripts/command_registry.js

/**
 * Manages the registration and lifecycle of all commands available in the shell.
 * This acts as a central repository for command instances, allowing for dynamic
 * loading and execution. It's the brains behind the operation!
 * @class CommandRegistry
 */
class CommandRegistry {
    /**
     * @constructor
     */
    constructor() {
        /**
         * A map of command names to their class instances.
         * @type {object}
         */
        this.commandDefinitions = {};
        /**
         * The dependency injection container.
         * @type {object}
         */
        this.dependencies = {};
    }

    /**
     * Sets the dependency injection container for the registry.
     * @param {object} dependencies - The dependencies to be injected.
     */
    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Registers a new command instance.
     * @param {Command} commandInstance - The command instance to register.
     */
    register(commandInstance) {
        if (commandInstance && commandInstance.commandName) {
            this.commandDefinitions[commandInstance.commandName] = commandInstance;
        } else {
            console.error(
                "Attempted to register an invalid command instance:",
                commandInstance
            );
        }
    }

    /**
     * Adds a command name to the global command manifest.
     * @param {string} commandName - The name of the command.
     */
    addCommandToManifest(commandName) {
        const { Config } = this.dependencies;
        if (!Config.COMMANDS_MANIFEST.includes(commandName)) {
            Config.COMMANDS_MANIFEST.push(commandName);
            Config.COMMANDS_MANIFEST.sort(); // Keep it tidy!
        }
    }

    /**
     * Removes a command name from the global command manifest.
     * @param {string} commandName - The name of the command.
     */
    removeCommandFromManifest(commandName) {
        const { Config } = this.dependencies;
        const index = Config.COMMANDS_MANIFEST.indexOf(commandName);
        if (index > -1) {
            Config.COMMANDS_MANIFEST.splice(index, 1);
        }
    }

    /**
     * Unregisters a command, removing it from the registry and manifest.
     * @param {string} commandName - The name of the command to unregister.
     * @returns {boolean} True if the command was successfully unregistered, false otherwise.
     */
    unregisterCommand(commandName) {
        if (this.commandDefinitions[commandName]) {
            delete this.commandDefinitions[commandName];
            this.removeCommandFromManifest(commandName);
            return true;
        }
        return false;
    }

    /**
     * Gets the definitions for all registered commands.
     * @returns {object} An object mapping command names to their definitions.
     */
    getDefinitions() {
        const definitionsOnly = {};
        for (const key in this.commandDefinitions) {
            definitionsOnly[key] = this.commandDefinitions[key].definition;
        }
        return definitionsOnly;
    }

    /**
     * Gets all registered command instances.
     * @returns {object} An object mapping command names to their instances.
     */
    getCommands() {
        return this.commandDefinitions;
    }
}