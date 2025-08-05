// scripts/managers/sound_manager.js

/**
 * @class SoundManager
 * @classdesc Manages all audio playback for the OopisOS system using the Tone.js library.
 * It handles the synthesis of sounds for beeps and musical notes.
 */
window.SoundManager = class SoundManager {
    /**
     * Creates an instance of SoundManager.
     * @param {object} dependencies - The dependency injection container.
     */
    constructor(dependencies) {
        /**
         * The dependency injection container.
         * @type {object}
         */
        this.dependencies = dependencies;
        /**
         * The Tone.js PolySynth instance for sound generation.
         * @type {Tone.PolySynth|null}
         */
        this.synth = null;
        /**
         * A flag indicating if the AudioContext has been initialized.
         * @type {boolean}
         */
        this.isInitialized = false;
    }

    /**
     * Initializes the Tone.js AudioContext and synthesizer.
     * This must be called in response to a user gesture (e.g., a click).
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;
        try {
            await Tone.start();
            this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
            this.isInitialized = true;
            console.log("SoundManager initialized successfully.");
        } catch (e) {
            console.error("SoundManager initialization failed:", e);
            this.isInitialized = false;
        }
    }

    /**
     * Gets the synthesizer instance, initializing it if necessary.
     * @returns {Tone.PolySynth|null} The synthesizer instance.
     */
    getSynth() {
        if (!this.isInitialized) {
            this.initialize();
        }
        return this.synth;
    }

    /**
     * Plays a short, standard system beep sound.
     */
    beep() {
        if (!this.isInitialized || !this.synth) {
            console.error("SoundManager not initialized. Cannot play beep.");
            return;
        }
        try {
            this.synth.triggerAttackRelease("G5", "32n", Tone.now());
        } catch (e) {
            console.error("Error playing beep:", e);
        }
    }

    /**
     * Plays one or more musical notes for a specified duration.
     * @param {string|string[]} notes - A single note (e.g., "C4") or an array of notes for a chord.
     * @param {string} duration - The duration of the note (e.g., "4n", "8t").
     */
    playNote(notes, duration) {
        if (!this.isInitialized || !this.synth) {
            console.error("SoundManager not initialized. Cannot play note.");
            return;
        }
        try {
            const now = Tone.now();
            this.synth.triggerAttackRelease(notes, duration, now);
        } catch (e) {
            console.error(`Error playing note(s): ${notes}`, e);
        }
    }
};