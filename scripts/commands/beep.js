/**
 * @file scripts/commands/beep.js
 * @description The 'beep' command, which plays a simple system sound. It serves as an auditory notification
 * and a way to test the sound system.
 */

/**
 * Represents the 'beep' command.
 * @class BeepCommand
 * @extends Command
 */
window.BeepCommand = class BeepCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "beep",
            description: "Plays a simple system beep.",
            helpText: `Usage: beep
      Plays a short, simple system tone through the emulated sound card.
      
      DESCRIPTION
      The beep command produces a standard terminal beep sound. It's useful
      for getting auditory feedback, such as signaling the completion of a
      long-running script or alerting the user to an event.
      
      This command requires the AudioContext to be active, which is
      initialized after the first user interaction with the terminal (a keypress or click).`
        });
    }

    /**
     * Main logic for the 'beep' command.
     * It ensures the SoundManager is initialized and then plays a system beep.
     * @param {object} context - The command execution context.
     * @param {object} context.dependencies - The system dependencies.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { SoundManager, ErrorHandler } = dependencies;

        if (!SoundManager.isInitialized) {
            await SoundManager.initialize();
            if (!SoundManager.isInitialized) {
                return ErrorHandler.createError(
                    "beep: AudioContext could not be started. Please click or type first."
                );
            }
        }

        SoundManager.beep();
        return ErrorHandler.createSuccess();
    }
};

window.CommandRegistry.register(new BeepCommand());