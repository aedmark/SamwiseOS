/**
 * Top User Interface - Manages the visual interface for the process viewer application.
 * @class TopUI
 */
window.TopUI = class TopUI {
    /**
     * Constructs a new TopUI instance.
     * @param {object} callbacks - An object containing callback functions for user interactions.
     * @param {object} dependencies - The dependency injection container.
     */
    constructor(callbacks, dependencies) {
        /** @type {object} A cache of DOM elements for the UI. */
        this.elements = {};
        /** @type {object} Callback functions for UI events. */
        this.callbacks = callbacks;
        /** @type {object} The dependency injection container. */
        this.dependencies = dependencies;
        this._buildLayout();
    }

    /**
     * Returns the main container element of the Top application.
     * @returns {HTMLElement} The root DOM element.
     */
    getContainer() {
        return this.elements.container;
    }

    /**
     * Builds the main UI layout, including the table for process display.
     * @private
     */
    _buildLayout() {
        const { Utils, UIComponents } = this.dependencies;

        const appWindow = UIComponents.createAppWindow('OopisOS Process Viewer', this.callbacks.onExit);
        this.elements.container = appWindow.container;
        this.elements.main = appWindow.main;

        this.elements.processList = Utils.createElement("tbody");
        const table = Utils.createElement("table", { className: "top-table" }, [
            Utils.createElement("thead", {},
                Utils.createElement("tr", {}, [
                    Utils.createElement("th", { textContent: "PID" }),
                    Utils.createElement("th", { textContent: "USER" }),
                    Utils.createElement("th", { textContent: "STAT" }),
                    Utils.createElement("th", { textContent: "COMMAND" }),
                ])
            ),
            this.elements.processList
        ]);

        this.elements.main.appendChild(table);
    }

    /**
     * Renders the list of processes in the table.
     * @param {Array<object>} processes - An array of process objects to display.
     */
    render(processes) {
        if (!this.elements.processList) return;

        this.elements.processList.innerHTML = "";

        if (processes.length === 0) {
            const row = this.dependencies.Utils.createElement("tr", {},
                this.dependencies.Utils.createElement("td", {
                    colSpan: 4,
                    textContent: "No background processes running.",
                    style: { textAlign: "center", fontStyle: "italic" }
                })
            );
            this.elements.processList.appendChild(row);
            return;
        }

        const fragment = document.createDocumentFragment();
        processes.forEach(proc => {
            const row = this.dependencies.Utils.createElement("tr", {}, [
                this.dependencies.Utils.createElement("td", { textContent: proc.pid }),
                this.dependencies.Utils.createElement("td", { textContent: proc.user }),
                this.dependencies.Utils.createElement("td", { textContent: proc.status }),
                this.dependencies.Utils.createElement("td", { textContent: proc.command }),
            ]);
            fragment.appendChild(row);
        });
        this.elements.processList.appendChild(fragment);
    }

    /**
     * Hides the application and removes its elements from the DOM.
     */
    hideAndReset() {
        if (this.elements.container) {
            this.elements.container.remove();
        }
        this.elements = {};
    }
}