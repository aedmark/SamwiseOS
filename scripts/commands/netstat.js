// scripts/commands/netstat.js

/**
 * @fileoverview This file defines the 'netstat' command, a utility for displaying
 * the current network status and discovered OopisOS instances.
 * @module commands/netstat
 */

/**
 * Represents the 'netstat' command for displaying network status.
 * @class NetstatCommand
 * @extends Command
 */
window.NetstatCommand = class NetstatCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "netstat",
            description: "Shows network status and connections.",
            helpText: `Usage: netstat
      Displays a list of all discovered OopisOS instances and their connection status.

      DESCRIPTION
      The netstat command provides a summary of the current network
      status. It lists your own instance ID and shows all other OopisOS
      instances that have been discovered on the local network or through
      the signaling server. It will also indicate which of these peers have
      an active, direct WebRTC connection.

      EXAMPLES
      netstat
      Displays your instance ID and a list of other known instances.`
        });
    }

    /**
     * Executes the core logic of the 'netstat' command.
     * It retrieves the local instance ID and a list of discovered remote instances
     * from the NetworkManager, formats this information into a readable list,
     * and returns it for display.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { NetworkManager, ErrorHandler } = dependencies;

        const output = [];
        output.push(`Your Instance ID: ${NetworkManager.getInstanceId()}`);
        output.push("\nDiscovered Remote Instances:");

        const remoteInstances = NetworkManager.getRemoteInstances();
        if (remoteInstances.length === 0) {
            output.push("  (None)");
        } else {
            remoteInstances.forEach(id => {
                const peer = NetworkManager.getPeers().get(id);
                const status = peer ? ` (Status: ${peer.connectionState})` : " (Status: Disconnected)";
                output.push(`  - ${id}${status}`);
            });
        }

        return ErrorHandler.createSuccess(output.join('\n'));
    }
};

window.CommandRegistry.register(new NetstatCommand());