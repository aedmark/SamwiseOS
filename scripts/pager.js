// scripts/pager.js

/**
 * @class PagerUI
 * @classdesc Manages the DOM elements and rendering for the pager application (like 'more' or 'less').
 */
class PagerUI {
  /**
   * Constructs a PagerUI instance.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(dependencies) {
    /**
     * A cache of the DOM elements used by the UI.
     * @type {object.<string, HTMLElement>}
     */
    this.elements = {};
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = dependencies;
  }

  /**
   * Creates the DOM structure for the pager and returns the main container.
   * @returns {HTMLElement} The main container element for the pager.
   */
  buildLayout() {
    const { Utils } = this.dependencies;
    this.elements.content = Utils.createElement("div", {
      id: "pager-content",
      className: "p-2 whitespace-pre-wrap",
    });
    this.elements.statusBar = Utils.createElement("div", {
      id: "pager-status",
      className: "bg-gray-700 text-white p-1 text-center font-bold",
    });
    this.elements.container = Utils.createElement(
        "div",
        {
          id: "pager-container",
          className: "flex flex-col h-full w-full bg-black text-white font-mono",
        },
        [this.elements.content, this.elements.statusBar]
    );
    return this.elements.container;
  }

  /**
   * Renders the visible portion of the content and updates the status bar.
   * @param {string[]} lines - All lines of the content to be displayed.
   * @param {number} topVisibleLine - The index of the first line to display.
   * @param {string} mode - The current pager mode ('more' or 'less').
   * @param {number} terminalRows - The number of rows that fit in the terminal view.
   */
  render(lines, topVisibleLine, mode, terminalRows) {
    if (!this.elements.content || !this.elements.statusBar) return;

    const visibleLines = lines.slice(
        topVisibleLine,
        topVisibleLine + terminalRows
    );
    this.elements.content.innerHTML = visibleLines.join("<br>");

    const percent =
        lines.length > 0
            ? Math.min(
                100,
                Math.round(((topVisibleLine + terminalRows) / lines.length) * 100)
            )
            : 100;
    this.elements.statusBar.textContent = `-- ${mode.toUpperCase()} -- (${percent}%) (q to quit)`;
  }

  /**
   * Calculates the number of text rows that can fit in the visible area.
   * @returns {number} The number of rows.
   */
  getTerminalRows() {
    const { Utils } = this.dependencies;
    if (!this.elements.content) return 24;
    const screenHeight = this.elements.content.clientHeight;
    const computedStyle = window.getComputedStyle(this.elements.content);
    const fontStyle = computedStyle.font;
    const { height: lineHeight } = Utils.getCharacterDimensions(fontStyle);
    if (lineHeight === 0) {
      return 24;
    }

    return Math.max(1, Math.floor(screenHeight / lineHeight));
  }

  /**
   * Resets the UI by clearing the element cache.
   */
  reset() {
    this.elements = {};
  }
}

/**
 * @class PagerManager
 * @classdesc Manages the state and logic for the pager application.
 */
class PagerManager {
  /**
   * Constructs a PagerManager instance.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(dependencies) {
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = dependencies;
    /**
     * The UI instance for the pager.
     * @type {PagerUI}
     */
    this.ui = new PagerUI(dependencies);
    /**
     * Whether the pager is currently active.
     * @type {boolean}
     */
    this.isActive = false;
    /**
     * The content split into an array of lines.
     * @type {string[]}
     */
    this.lines = [];
    /**
     * The index of the first visible line.
     * @type {number}
     */
    this.topVisibleLine = 0;
    /**
     * The number of rows visible in the terminal.
     * @type {number}
     */
    this.terminalRows = 24;
    /**
     * The pager mode ('more' or 'less').
     * @type {string}
     */
    this.mode = "more";
    /**
     * A callback to resolve the promise when the pager exits.
     * @type {Function|null}
     */
    this.exitCallback = null;
    /**
     * The bound keydown event handler.
     * @type {Function}
     * @private
     */
    this._boundHandleKeyDown = this._handleKeyDown.bind(this);
  }

  /**
   * Handles keyboard input for navigating the pager.
   * @private
   * @param {KeyboardEvent} e - The keyboard event.
   */
  _handleKeyDown(e) {
    if (!this.isActive) return;

    e.preventDefault();
    let scrolled = false;

    switch (e.key) {
      case "q":
        this.exit();
        break;
      case " ":
      case "f":
        this.topVisibleLine = Math.min(
            this.topVisibleLine + this.terminalRows,
            Math.max(0, this.lines.length - this.terminalRows)
        );
        scrolled = true;
        break;
      case "ArrowDown":
        if (this.mode === "less") {
          this.topVisibleLine = Math.min(
              this.topVisibleLine + 1,
              Math.max(0, this.lines.length - this.terminalRows)
          );
          scrolled = true;
        }
        break;
      case "b":
      case "ArrowUp":
        if (this.mode === "less") {
          this.topVisibleLine = Math.max(0, this.topVisibleLine - this.terminalRows);
          scrolled = true;
        }
        break;
    }

    if (scrolled) {
      this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
    }
  }

  /**
   * Activates and displays the pager with the given content.
   * @param {string} content - The text content to display.
   * @param {object} options - Options for the pager.
   * @param {string} options.mode - The pager mode ('more' or 'less').
   * @returns {Promise<void>} A promise that resolves when the pager is closed.
   */
  enter(content, options) {
    if (this.isActive) return;
    this.isActive = true;

    this.lines = content.split("\n");
    this.topVisibleLine = 0;
    this.mode = options.mode || "more";

    const pagerElement = this.ui.buildLayout();
    this.dependencies.AppLayerManager.show(pagerElement);

    document.addEventListener("keydown", this._boundHandleKeyDown);

    setTimeout(() => {
      this.terminalRows = this.ui.getTerminalRows();
      this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
    }, 0);

    return new Promise((resolve) => {
      this.exitCallback = resolve;
    });
  }

  /**
   * Deactivates and hides the pager, cleaning up event listeners and state.
   */
  exit() {
    if (!this.isActive) return;
    document.removeEventListener("keydown", this._boundHandleKeyDown);
    this.dependencies.AppLayerManager.hide();
    this.ui.reset();

    this.isActive = false;
    this.lines = [];
    this.topVisibleLine = 0;

    if (this.exitCallback) {
      this.exitCallback();
      this.exitCallback = null;
    }
  }
}