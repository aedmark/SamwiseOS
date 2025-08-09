// scripts/apps/adventure/adventure_manager.js

/**
 * Text Adventure Game Manager - Handles the execution of interactive fiction games
 * @class AdventureManager
 * @extends App
 */
window.AdventureManager = class AdventureManager extends App {
    /**
     * Create an adventure manager instance
     */
    constructor() {
        super();
        /** @type {Object} Game state including player, adventure data, and context */
        this.state = {};
        /** @type {Object} Injected dependencies */
        this.dependencies = {};
        /** @type {Object} Callback functions for UI interaction */
        this.callbacks = {};
        /** @type {Object|null} UI modal instance */
        this.ui = null;
    }

    /**
     * Enter the adventure game
     * @param {HTMLElement} appLayer - DOM element to attach the game UI
     * @param {Object} options - Configuration options
     * @param {Object} options.dependencies - Required dependencies
     * @param {Object} options.adventureData - Adventure game data
     * @param {Object} [options.scriptingContext] - Scripting context for automated play
     */
    async enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        const { TextAdventureModal } = this.dependencies;

        this.callbacks = {
            processCommand: this.processCommand.bind(this),
            onExitRequest: this.exit.bind(this),
        };

        this.isActive = true;

        // Initialize state via Python kernel
        const initialStateResult = JSON.parse(
            OopisOS_Kernel.adventureInitializeState(
                JSON.stringify(options.adventureData),
                options.scriptingContext ? JSON.stringify(options.scriptingContext) : null
            )
        );

        this.ui = new TextAdventureModal(
            this.callbacks,
            this.dependencies,
            options.scriptingContext
        );
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        // Apply initial updates from Python
        if (initialStateResult.success) {
            this._applyUiUpdates(initialStateResult.updates);
        } else {
            this.ui.appendOutput(initialStateResult.error, "error");
        }

        if (options.scriptingContext?.isScripting) {
            await this._runScript(options.scriptingContext);
        } else {
            setTimeout(() => this.container.focus(), 0);
        }
    }

    _applyUiUpdates(updates) {
        updates.forEach(update => {
            switch (update.type) {
                case "output":
                    this.ui.appendOutput(update.text, update.styleClass);
                    break;
                case "status":
                    this.ui.updateStatusLine(update.roomName, update.score, update.moves);
                    break;
            }
        });
    }

    /**
     * Run the adventure in scripting mode
     * @private
     */
    async _runScript(scriptingContext) {
        while (
            scriptingContext.currentLineIndex < scriptingContext.lines.length - 1 &&
            this.isActive
            ) {
            let nextCommand = await this.ui.requestInput("");
            if (nextCommand === null) break;
            await this.processCommand(nextCommand);
        }
        if (this.isActive) {
            this.exit();
        }
    }

    /**
     * Exit the adventure game
     */
    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;
        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
        this.ui = null;
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.exit();
        }
    }

    /**
     * Process a command through the Python game engine
     * @param {string} command - Player command
     */
    processCommand(command) {
        const result = JSON.parse(OopisOS_Kernel.adventureProcessCommand(command));
        if (result.success) {
            this._applyUiUpdates(result.updates);
            if (result.gameOver) {
                this.ui.elements.input.disabled = true;
            }
        } else {
            this.ui.appendOutput(result.error, "error");
        }
    }
}