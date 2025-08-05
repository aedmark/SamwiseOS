/**
 * Log User Interface - Manages the visual interface for the log application.
 * @class LogUI
 */
window.LogUI = class LogUI {
  /**
   * Constructs a new LogUI instance.
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
   * Returns the main container element of the log application.
   * @returns {HTMLElement} The root DOM element.
   */
  getContainer() {
    return this.elements.container;
  }

  /**
   * Builds the main UI layout, including the search bar, buttons, entry list, and content view.
   * @private
   */
  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow("Captain's Log", this.callbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.header = appWindow.header;
    this.elements.main = appWindow.main;

    this.elements.searchBar = Utils.createElement("input", {
      id: "log-search-bar",
      type: "text",
      placeholder: "Search entries...",
      className: "log-app__search",
    });

    this.elements.newBtn = Utils.createElement("button", {
      id: "log-new-btn",
      textContent: "New Entry",
      className: "btn",
    });
    this.elements.saveBtn = Utils.createElement("button", {
      id: "log-save-btn",
      textContent: "Save Changes",
      className: "btn hidden",
    });

    const actionButtons = Utils.createElement("div", { className: "log-app__actions" }, [
      this.elements.newBtn,
      this.elements.saveBtn,
    ]);

    this.elements.header.append(this.elements.searchBar, actionButtons);

    this.elements.entryList = Utils.createElement("div", {
      id: "log-entry-list",
      className: "log-app__list-pane",
    });
    this.elements.contentView = Utils.createElement("textarea", {
      id: "log-content-view",
      className: "log-app__content-pane",
      placeholder: "Select an entry to view or edit...",
    });

    this.elements.main.append(this.elements.entryList, this.elements.contentView);

    this.elements.searchBar.addEventListener("input", () =>
        this.callbacks.onSearch(this.elements.searchBar.value)
    );
    this.elements.newBtn.addEventListener("click", () => this.callbacks.onNew());
    this.elements.saveBtn.addEventListener("click", () => this.callbacks.onSave());
    this.elements.contentView.addEventListener("input", () =>
        this.callbacks.onContentChange(this.elements.contentView.value)
    );
  }

  /**
   * Renders the list of log entries in the left pane.
   * @param {Array<object>} entries - An array of log entry objects to display.
   * @param {string|null} selectedPath - The path of the currently selected entry.
   */
  renderEntries(entries, selectedPath) {
    if (!this.elements.entryList) return;
    const { Utils } = this.dependencies;
    this.elements.entryList.innerHTML = "";
    if (entries.length === 0) {
      this.elements.entryList.textContent = "No entries found.";
      return;
    }
    entries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const title =
          entry.content
              .split("\n")[0]
              .replace(/^#+\s*/, "")
              .substring(0, 40) || "(Untitled)";
      const item = Utils.createElement(
          "div",
          {
            className: "log-app__list-item",
            "data-path": entry.path,
          },
          [
            Utils.createElement("strong", { textContent: date.toLocaleString() }),
            Utils.createElement("span", { textContent: title }),
          ]
      );
      if (entry.path === selectedPath) {
        item.classList.add("selected");
      }
      item.addEventListener("click", () => this.callbacks.onSelect(entry.path));
      this.elements.entryList.appendChild(item);
    });
  }

  /**
   * Renders the content of a selected log entry in the right pane.
   * @param {object|null} entry - The log entry object to display, or null to clear the view.
   */
  renderContent(entry) {
    if (!this.elements.contentView) return;
    if (!entry) {
      this.elements.contentView.value = "";
      this.elements.contentView.placeholder = "Select an entry to view or edit...";
      this.elements.saveBtn.classList.add("hidden");
      return;
    }
    this.elements.contentView.value = entry.content;
  }

  /**
   * Toggles the visibility of the "Save Changes" button based on the dirty state.
   * @param {boolean} isDirty - Whether the current entry has unsaved changes.
   */
  updateSaveButton(isDirty) {
    if (this.elements.saveBtn) {
      this.elements.saveBtn.classList.toggle("hidden", !isDirty);
    }
  }

  /**
   * Gets the current content of the editor textarea.
   * @returns {string} The content of the textarea.
   */
  getContent() {
    return this.elements.contentView ? this.elements.contentView.value : "";
  }

  /**
   * Resets the UI state and clears all DOM elements.
   */
  reset() {
    this.elements = {};
    this.callbacks = {};
    this.dependencies = {};
  }
};