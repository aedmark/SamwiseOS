// scripts/output_manager.js

/**
 * Manages all output to the terminal, including command results, errors, and system messages.
 * It also handles overriding console methods to redirect their output to the terminal.
 * @class OutputManager
 */
class OutputManager {
  /**
   * Constructs a new OutputManager instance.
   */
  constructor() {
    /**
     * Flag indicating if a full-screen application is active, which might suppress terminal output.
     * @type {boolean}
     */
    this.isEditorActive = false;
    /**
     * A cached reference to the main output DOM element.
     * @type {HTMLElement|null}
     */
    this.cachedOutputDiv = null;
    /**
     * A cached reference to the input line's container DOM element.
     * @type {HTMLElement|null}
     */
    this.cachedInputLineContainerDiv = null;
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
    /**
     * A reference to the original console.log function.
     * @type {Function}
     */
    this.originalConsoleLog = console.log;
    /**
     * A reference to the original console.warn function.
     * @type {Function}
     */
    this.originalConsoleWarn = console.warn;
    /**
     * A reference to the original console.error function.
     * @type {Function}
     */
    this.originalConsoleError = console.error;
  }

  /**
   * Initializes the OutputManager with references to key DOM elements.
   * @param {object} dom - An object containing references to core DOM elements.
   */
  initialize(dom) {
    this.cachedOutputDiv = dom.outputDiv;
    this.cachedInputLineContainerDiv = dom.inputLineContainerDiv;
  }

  /**
   * Sets the dependency injection container.
   * @param {object} injectedDependencies - The dependencies to be injected.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  /**
   * Sets the editor active status to control output suppression.
   * @param {boolean} status - True if a full-screen app is active, false otherwise.
   */
  setEditorActive(status) {
    this.isEditorActive = status;
  }

  /**
   * Appends text to the terminal output div, handling various formatting options.
   * @param {string} text - The text to append.
   * @param {object} [options={}] - Options for formatting the output.
   * @param {string} [options.typeClass] - A CSS class to apply to the output line.
   * @param {boolean} [options.isBackground=false] - Whether the output is from a background process.
   * @param {boolean} [options.asBlock=false] - Whether to render the text as a raw HTML block.
   * @returns {Promise<void>}
   */
  async appendToOutput(text, options = {}) {
    const { Config, TerminalUI, Utils } = this.dependencies;
    if (
        this.isEditorActive &&
        options.typeClass !== Config.CSS_CLASSES.EDITOR_MSG &&
        !options.isCompletionSuggestion
    )
      return;
    if (!this.cachedOutputDiv) {
      this.originalConsoleError(
          "OutputManager.appendToOutput: cachedOutputDiv is not defined. Message:",
          text
      );
      return;
    }
    const { typeClass = options.messageType || null, isBackground = false, asBlock = false } = options;

    if (
        isBackground &&
        this.cachedInputLineContainerDiv &&
        !this.cachedInputLineContainerDiv.classList.contains(Config.CSS_CLASSES.HIDDEN)
    ) {
      const promptText = TerminalUI.getPromptText() || "> ";
      const currentInputVal = TerminalUI.getCurrentInputValue();
      const echoLine = Utils.createElement("div", {
        className: Config.CSS_CLASSES.OUTPUT_LINE,
        textContent: `${promptText}${currentInputVal}`,
      });
      this.cachedOutputDiv.appendChild(echoLine);
    }

    if (asBlock) {
      const blockWrapper = Utils.createElement("div", {
        className: typeClass || "",
        innerHTML: text,
      });
      this.cachedOutputDiv.appendChild(blockWrapper);
      this.cachedOutputDiv.scrollTop = this.cachedOutputDiv.scrollHeight;
      return;
    }

    const lines = String(text).split("\n");
    const fragment = document.createDocumentFragment();

    for (const line of lines) {
      const lineClasses = Config.CSS_CLASSES.OUTPUT_LINE.split(" ");
      const lineAttributes = {
        classList: [...lineClasses],
        textContent: line,
      };

      if (typeClass) {
        typeClass.split(" ").forEach((cls) => {
          if (cls) lineAttributes.classList.push(cls);
        });
      }

      fragment.appendChild(Utils.createElement("div", lineAttributes));
    }

    this.cachedOutputDiv.appendChild(fragment);
    this.cachedOutputDiv.scrollTop = this.cachedOutputDiv.scrollHeight;
  }

  /**
   * Clears all content from the terminal output div.
   */
  clearOutput() {
    if (!this.isEditorActive && this.cachedOutputDiv) {
      while (this.cachedOutputDiv.firstChild) {
        this.cachedOutputDiv.removeChild(this.cachedOutputDiv.firstChild);
      }
    }
  }

  /**
   * Overrides console.log to print to the terminal.
   * @private
   * @param {...*} args - The arguments to log.
   */
  _consoleLogOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`LOG: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      });
    this.originalConsoleLog.apply(console, args);
  }

  /**
   * Overrides console.warn to print to the terminal.
   * @private
   * @param {...*} args - The arguments to warn about.
   */
  _consoleWarnOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`WARN: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.WARNING_MSG,
      });
    this.originalConsoleWarn.apply(console, args);
  }

  /**
   * Overrides console.error to print to the terminal.
   * @private
   * @param {...*} args - The arguments to log as an error.
   */
  _consoleErrorOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`ERROR: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
    this.originalConsoleError.apply(console, args);
  }

  /**
   * Initializes the console overrides, replacing the default console methods.
   */
  initializeConsoleOverrides() {
    if (
        typeof this.dependencies.Utils === "undefined" ||
        typeof this.dependencies.Utils.formatConsoleArgs !== "function"
    ) {
      this.originalConsoleError(
          "OutputManager: Cannot initialize console overrides, Utils or Utils.formatConsoleArgs is not defined."
      );
      return;
    }
    console.log = this._consoleLogOverride.bind(this);
    console.warn = this._consoleWarnOverride.bind(this);
    console.error = this._consoleErrorOverride.bind(this);
  }
}