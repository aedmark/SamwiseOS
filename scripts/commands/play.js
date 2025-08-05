// scripts/commands/play.js

/**
 * @fileoverview This file defines the 'play' command, a utility for playing
 * musical notes and chords through the system synthesizer.
 * @module commands/play
 */

/**
 * Represents the 'play' command for playing musical notes.
 * @class PlayCommand
 * @extends Command
 */
window.PlayCommand = class PlayCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "play",
            description: "Plays a musical note or chord for a specific duration.",
            helpText: `Usage: play "<note or chord>" <duration>
      Plays a musical note or chord using the system synthesizer.
      DESCRIPTION
      The play command uses the Tone.js synthesizer.
      - "<note or chord>": Standard musical notation (e.g., C4, "F#5 G5", "A3 C4 E4"). For chords, enclose the notes in quotes.
      - <duration>: Note duration (e.g., 4n, 8n, 1m).
      EXAMPLES
      play C4 4n
      play "A3 C4 E4" 2n`,
            argValidation: {
                min: 2,
                max: 2,
                error: "Usage: play \"<note or chord>\" <duration>",
            },
        });
    }

    /**
     * Executes the core logic of the 'play' command.
     * It parses the note and duration arguments, ensures the SoundManager is initialized,
     * triggers the note playback, and waits for the specified duration before completing.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { SoundManager, ErrorHandler } = dependencies;
        const [notesString, duration] = args;

        if (!SoundManager.isInitialized) {
            await SoundManager.initialize();
            if (!SoundManager.isInitialized) {
                return ErrorHandler.createError({
                    message: "play: AudioContext could not be started. Please click or type first."
                });
            }
        }

        const notes = notesString.split(' ');

        SoundManager.playNote(notes, duration);

        const durationInSeconds = new Tone.Time(duration).toSeconds();
        const durationInMs = Math.ceil(durationInSeconds * 1000);

        await new Promise(resolve => setTimeout(resolve, durationInMs));

        return ErrorHandler.createSuccess();
    }
};

window.CommandRegistry.register(new PlayCommand());