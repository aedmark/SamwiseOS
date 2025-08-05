// scripts/commands/nc.js

/**
 * @fileoverview This file defines the 'nc' (netcat) command, a utility for
 * sending and receiving messages between OopisOS instances over the network.
 * @module commands/nc
 */

/**
 * Represents the 'nc' command for network communication.
 * @class NcCommand
 * @extends Command
 */
window.NcCommand = class NcCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "nc",
            description: "Netcat utility for network communication.",
            helpText: `Usage: nc [--listen [--exec]] | [<targetId> "<message>"]
      A utility for network communication between OopisOS instances.
      DESCRIPTION
      The nc (netcat) command is a versatile networking tool for OopisOS.
      It can be used to send direct messages to other instances or to
      set up a listener to receive incoming messages.
      MODES
      Listen Mode:
      nc --listen
      Puts the terminal in listening mode, printing any incoming
      messages from other OopisOS instances.
      Direct Send Mode:
      nc <target_instance_id> "<message>"
      Sends a direct message to another instance. Use 'netstat' to
      find instance IDs.
      OPTIONS
      --exec
      Used with --listen, this will execute any incoming messages
      as OopisOS commands. Requires root privileges.
      WARNING: --exec is a major security risk. Only use this
      with trusted peers.`,
            flagDefinitions: [
                { name: "listen", short: "--listen" },
                { name: "exec", short: "--exec" },
            ]
        });
    }

    /**
     * Executes the core logic of the 'nc' command.
     * It handles two main modes: listening for incoming messages (with an optional
     * command execution feature for root) and sending a direct message to another instance.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { NetworkManager, ErrorHandler, CommandExecutor } = dependencies;

        if (flags.listen) {
            if (flags.exec && currentUser !== 'root') {
                return ErrorHandler.createError({ message: "nc: --exec requires root privileges." });
            }

            const mode = flags.exec ? 'execute' : 'print';
            await dependencies.OutputManager.appendToOutput(`Listening for messages on instance ${NetworkManager.getInstanceId()} in '${mode}' mode... (Press Ctrl+C to stop)`);

            NetworkManager.setListenCallback((payload) => {
                const { sourceId, data } = payload;
                if (flags.exec) {
                    dependencies.OutputManager.appendToOutput(`[NET EXEC from ${sourceId}]> ${data}`);
                    CommandExecutor.processSingleCommand(data, { isInteractive: false });
                } else {
                    dependencies.OutputManager.appendToOutput(`[NET] From ${sourceId}: ${data}`);
                }
            });

            return ErrorHandler.createSuccess();
        }

        if (args.length !== 2) {
            return ErrorHandler.createError({ message: "Usage: nc <targetId> \"<message>\"" });
        }

        const targetId = args[0];
        const message = args[1];

        await NetworkManager.sendMessage(targetId, 'direct_message', message);
        return ErrorHandler.createSuccess();
    }
};

window.CommandRegistry.register(new NcCommand());