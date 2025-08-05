// scripts/commands/delay.js

/**
 * @fileoverview This file defines the 'delay' command, a utility for pausing
 * execution for a specified duration in milliseconds, primarily for use in scripts.
 * @module commands/delay
 */

/**
 * Represents the 'delay' command.
 * @class DelayCommand
 * @extends Command
 */
window.DelayCommand = class DelayCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "delay",
            description: "Pauses script or command execution for a specified time.",
            helpText: `Usage: delay <milliseconds>
      Pause execution for a specified time.
      DESCRIPTION
      The delay command pauses execution for the specified number of
      milliseconds.
      It is primarily used within scripts ('run' command) to create
      timed sequences or demonstrations.
      EXAMPLES
      delay 1000
      Waits for 1000 milliseconds (1 second).
      delay 5000 &
      Starts a 5-second delay in the background. The job ID
      will be printed, and you can see it with 'ps'.`,
            validations: {
                args: {
                    exact: 1
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'delay' command.
     * It parses the millisecond argument and waits for that duration,
     * while also listening for an abort signal to cancel the delay.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, options, signal, dependencies } = context;
        const { Utils, ErrorHandler, OutputManager } = dependencies;

        const parsedArg = Utils.parseNumericArg(args[0], {
            allowFloat: false,
            allowNegative: false,
            min: 1,
        });

        if (parsedArg.error) {
            return ErrorHandler.createError({
                message: `delay: Invalid delay time '${args[0]}': ${parsedArg.error}. Must be a positive integer.`
            });
        }

        const ms = parsedArg.value;

        if (options.isInteractive && !options.scriptingContext) {
            await OutputManager.appendToOutput(`Delaying for ${ms}ms...`);
        }

        if (signal?.aborted) {
            return ErrorHandler.createError({
                message: `delay: Operation already cancelled.`
            });
        }

        // Use a safe delay function instead of setTimeout
        const delayPromise = Utils.safeDelay(ms);

        const abortPromise = new Promise((resolve) => {
            if (!signal) return;
            signal.addEventListener(
                "abort",
                () => {
                    resolve("cancelled");
                },
                { once: true }
            );
        });

        const result = await Promise.race([delayPromise, abortPromise]);

        if (result === "cancelled") {
            return ErrorHandler.createSuccess("");
        }

        if (options.isInteractive && !options.scriptingContext) {
            await OutputManager.appendToOutput(`Delay complete.`);
        }
        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new DelayCommand());