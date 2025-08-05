/**
 * Top Manager - Manages the state and logic for the process viewer application.
 * @class TopManager
 * @extends App
 */
window.TopManager = class TopManager extends App {
    /**
     * Constructs a new TopManager instance.
     */
    constructor() {
        super();
        /** @type {object} The application's internal state. */
        this.state = {};
        /** @type {object} The dependency injection container. */
        this.dependencies = {};
        /** @type {object} A collection of UI callback functions. */
        this.callbacks = {};
        /** @type {TopUI|null} The UI component instance. */
        this.ui = null;
        /** @type {number|null} The interval ID for the process list update timer. */
        this.updateInterval = null;
    }

    /**
     * Initializes and displays the Top application.
     * @param {HTMLElement} appLayer - The DOM element to append the app's UI to.
     * @param {object} [options={}] - Options for entering the application.
     */
    enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();
        this.isActive = true;

        this.ui = new this.dependencies.TopUI(this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        this.updateInterval = setInterval(() => this._updateProcessList(), 1000);
        this._updateProcessList();
    }

    /**
     * Exits the Top application, clearing the update interval and cleaning up UI.
     */
    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;

        clearInterval(this.updateInterval);
        this.updateInterval = null;

        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
        this.ui = null;
    }

    /**
     * Handles keyboard events for the application, specifically for quitting.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    handleKeyDown(event) {
        if (event.key === "q") {
            this.exit();
        }
    }

    /**
     * Creates and returns a set of callback functions for UI events.
     * @private
     * @returns {object} An object containing the callback functions.
     */
    _createCallbacks() {
        return {
            /** Callback for exiting the application. */
            onExit: this.exit.bind(this),
        };
    }

    /**
     * Fetches the current list of running processes and updates the UI.
     * @private
     */
    _updateProcessList() {
        const { CommandExecutor } = this.dependencies;
        const jobs = CommandExecutor.getActiveJobs();
        const processes = Object.keys(jobs).map(pid => {
            const job = jobs[pid];
            return {
                pid: pid,
                user: job.user || 'system',
                status: job.status.toUpperCase().charAt(0),
                command: job.command,
            };
        });

        if (this.ui) {
            this.ui.render(processes);
        }
    }
};