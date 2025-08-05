// scripts/commands/ping.js

/**
 * @fileoverview This file defines the 'ping' command, a utility for checking
 * network connectivity to both standard web hosts and other OopisOS instances.
 * @module commands/ping
 */

/**
 * Represents the 'ping' command.
 * @class PingCommand
 * @extends Command
 */
window.PingCommand = class PingCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "ping",
            description: "Sends a request to a network host or OopisOS instance.",
            helpText: `Usage: ping <hostname_or_instanceId>
      Send a request to a host to check for connectivity.
      DESCRIPTION
      The ping command sends a request to a network host to determine
      if it is reachable and to measure the round-trip time.
      It has two modes of operation:
      1. Web Host Mode:
         For a standard hostname/URL (e.g., oopisos.com), it sends a
         lightweight HTTP HEAD request to the host.
      2. OopisOS Instance Mode:
         For an OopisOS instance ID (e.g., oos-123456-789), it sends a
         special 'ping' message via the NetworkManager and waits for a
         'pong' response to measure latency between instances.
      EXAMPLES
      ping oopisos.com
      ping oos-1672533600000-123`,
            validations: {
                args: { exact: 1, error: "Usage: ping <hostname_or_instanceId>" }
            },
        });
    }

    /**
     * Executes the core logic of the 'ping' command.
     * It checks if the target is an OopisOS instance ID or a standard hostname.
     * For instances, it uses the NetworkManager to send a ping. For hostnames,
     * it performs an HTTP HEAD request to measure response time.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, OutputManager, Config, NetworkManager } = dependencies;
        const target = args[0];

        if (target.startsWith('oos-')) {
            await OutputManager.appendToOutput(`Pinging OopisOS instance ${target}...`);
            try {
                const rtt = await NetworkManager.sendPing(target);
                return ErrorHandler.createSuccess(
                    `Pong from ${target}: time=${rtt}ms`,
                    { messageType: Config.CSS_CLASSES.SUCCESS_MSG }
                );
            } catch (e) {
                return ErrorHandler.createError({ message: `Request to ${target} timed out.` });
            }
        }

        let host = target;
        if (!host.startsWith('http://') && !host.startsWith('https://')) {
            host = 'https://' + host;
        }

        let url;
        try {
            url = new URL(host);
        } catch (e) {
            return ErrorHandler.createError({ message: `ping: invalid URL: ${host}` });
        }

        await OutputManager.appendToOutput(`PING ${url.hostname} (${url.origin})...`);
        const startTime = performance.now();
        try {
            await fetch(url.origin, { method: 'HEAD', mode: 'no-cors' });
            const endTime = performance.now();
            const timeTaken = (endTime - startTime).toFixed(2);
            return ErrorHandler.createSuccess(
                `Reply from ${url.hostname}: time=${timeTaken}ms`,
                { messageType: Config.CSS_CLASSES.SUCCESS_MSG }
            );
        } catch (e) {
            if (e instanceof TypeError) {
                return ErrorHandler.createError({ message: `Request to ${url.hostname} failed: No route to host.` });
            }
            return ErrorHandler.createError({ message: `ping: an unexpected error occurred: ${e.message}` });
        }
    }
}

window.CommandRegistry.register(new PingCommand());