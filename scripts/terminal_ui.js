// scripts/terminal_ui.js

/**
 * @class TerminalUI
 * @classdesc Manages the user interface of the terminal, including the input line,
 * command prompt, and caret positioning. It acts as the primary interface for user interaction
 * with the command line.
 */
class TerminalUI {
  /**
   * Creates an instance of TerminalUI.
   */
  constructor() {
    /**
     * A flag to indicate if the user is currently navigating through command history.
     * @type {boolean}
     */
    this.isNavigatingHistory = false;
    /**
     * A flag for handling obscured input, like passwords.
     * @type {boolean}
     * @private
     */
    this._isObscuredInputMode = false;
    /**
     * A cache of key DOM elements for the terminal.
     * @type {object.<string, HTMLElement>}
     */
    this.elements = {};
    /**
     * Stores the actual string value during obscured input mode.
     * @type {string}
     */
    this.originalInputForObscure = "";
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
  }

  /**
   * Initializes the TerminalUI with references to essential DOM elements.
   * @param {object} dom - An object containing references to the terminal's DOM elements.
   */
  initialize(dom) {
    this.elements = dom;
  }

  /**
   * Sets the dependency injection container.
   * @param {object} injectedDependencies - The dependencies to be injected.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  /**
   * Updates the command prompt display based on the current user, path, and PS1 environment variable.
   */
  updatePrompt() {
    const { UserManager, FileSystemManager, EnvironmentManager, Config } = this.dependencies;
    const user = UserManager.getCurrentUser() || {
      name: Config.USER.DEFAULT_NAME,
    };
    const ps1 = EnvironmentManager.get("PS1");

    if (!this.elements.promptContainer) return;

    if (ps1) {
      const host =
          EnvironmentManager.get("HOST") || Config.OS.DEFAULT_HOST_NAME;
      const path = FileSystemManager.getCurrentPath() || Config.FILESYSTEM.ROOT_PATH;
      const homeDir = `/home/${user.name}`;
      const displayPath = path.startsWith(homeDir)
          ? `~${path.substring(homeDir.length)}`
          : path;

      let parsedPrompt = ps1
          .replace(/\\u/g, user.name)
          .replace(/\\h/g, host)
          .replace(/\\w/g, displayPath)
          .replace(/\\W/g, path.substring(path.lastIndexOf("/") + 1) || "/")
          .replace(/\\$/g, user.name === "root" ? "#" : "$")
          .replace(/\\s/g, "OopisOS")
          .replace(/\\\\/g, "\\");

      this.elements.promptContainer.textContent = parsedPrompt;
    } else {
      const path = FileSystemManager.getCurrentPath();
      const promptChar =
          user.name === "root" ? "#" : Config.TERMINAL.PROMPT_CHAR;
      this.elements.promptContainer.textContent = `${user.name}${Config.TERMINAL.PROMPT_AT}${Config.OS.DEFAULT_HOST_NAME}${Config.TERMINAL.PROMPT_SEPARATOR}${path}${promptChar} `;
    }
  }

  /**
   * Gets the current text content of the command prompt.
   * @returns {string} The prompt text.
   */
  getPromptText() {
    return this.elements.promptContainer ? this.elements.promptContainer.textContent : "";
  }

  /**
   * Sets focus to the editable input field.
   */
  focusInput() {
    if (
        this.elements.editableInputDiv &&
        this.elements.editableInputDiv.contentEditable === "true"
    ) {
      this.elements.editableInputDiv.focus();
      if (this.elements.editableInputDiv.textContent.length === 0)
        this.setCaretToEnd(this.elements.editableInputDiv);
    }
  }

  /**
   * Clears the content of the input field.
   */
  clearInput() {
    if (this.elements.editableInputDiv) this.elements.editableInputDiv.textContent = "";
    this.originalInputForObscure = "";
  }

  /**
   * Gets the current value of the input field, accounting for obscured mode.
   * @returns {string} The current input value.
   */
  getCurrentInputValue() {
    return this._isObscuredInputMode
        ? this.originalInputForObscure
        : this.elements.editableInputDiv
            ? this.elements.editableInputDiv.textContent
            : "";
  }

  /**
   * Sets the value of the input field.
   * @param {string} value - The new value for the input.
   * @param {boolean} [setAtEnd=true] - Whether to move the caret to the end of the input.
   */
  setCurrentInputValue(value, setAtEnd = true) {
    if (this.elements.editableInputDiv) {
      if (this._isObscuredInputMode) {
        this.originalInputForObscure = value;
        this.elements.editableInputDiv.textContent = "*".repeat(value.length);
      } else {
        this.elements.editableInputDiv.textContent = value;
      }
      if (setAtEnd) this.setCaretToEnd(this.elements.editableInputDiv);
    }
  }
  /**
   * Updates the internal value and visual display for obscured (password) input.
   * @param {string} key - The key that was pressed ('Backspace', 'Delete', or a character).
   */
  updateInputForObscure(key) {
    const selection = this.getSelection();
    let { start, end } = selection;

    if (key === "Backspace") {
      if (start === end && start > 0) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start - 1) +
            this.originalInputForObscure.slice(start);
        start--;
      } else if (start !== end) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(end);
      }
    } else if (key === "Delete") {
      if (start === end && start < this.originalInputForObscure.length) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(start + 1);
      } else if (start !== end) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(end);
      }
    } else if (key.length === 1) {
      this.originalInputForObscure =
          this.originalInputForObscure.slice(0, start) +
          key +
          this.originalInputForObscure.slice(end);
      start += key.length;
    }

    this.elements.editableInputDiv.textContent = "*".repeat(
        this.originalInputForObscure.length
    );
    this.setCaretPosition(this.elements.editableInputDiv, start);
  }

  /**
   * Moves the caret to the end of the specified content-editable element.
   * @param {HTMLElement} element - The element to move the caret in.
   */
  setCaretToEnd(element) {
    if (
        !element ||
        typeof window.getSelection === "undefined" ||
        typeof document.createRange === "undefined"
    )
      return;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    element.focus();
  }

  /**
   * Sets the caret position within a content-editable element.
   * @param {HTMLElement} element - The element to set the caret in.
   * @param {number} position - The character offset to place the caret at.
   */
  setCaretPosition(element, position) {
    if (
        !element ||
        typeof position !== "number" ||
        typeof window.getSelection === "undefined" ||
        typeof document.createRange === "undefined"
    )
      return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let charCount = 0;
    let foundNode = false;

    function findTextNodeAndSet(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + node.length;
        if (!foundNode && position >= charCount && position <= nextCharCount) {
          range.setStart(node, position - charCount);
          range.collapse(true);
          foundNode = true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (findTextNodeAndSet(node.childNodes[i])) return true;
          if (foundNode) break;
        }
      }
      return foundNode;
    }

    if (element.childNodes.length === 0 && position === 0) {
      range.setStart(element, 0);
      range.collapse(true);
      foundNode = true;
    } else findTextNodeAndSet(element);
    if (foundNode) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else this.setCaretToEnd(element);
    element.focus();
  }

  /**
   * Sets the state of the input field (editable/disabled and obscured/visible).
   * @param {boolean} isEditable - Whether the input should be editable.
   * @param {boolean} [obscured=false] - Whether the input should be obscured (for passwords).
   */
  setInputState(isEditable, obscured = false) {
    if (this.elements.editableInputDiv) {
      this.elements.editableInputDiv.contentEditable = isEditable ? "true" : "false";
      this.elements.editableInputDiv.style.opacity = isEditable ? "1" : "0.5";
      this._isObscuredInputMode = obscured;
      if (isEditable && obscured) {
        this.originalInputForObscure = "";
        this.elements.editableInputDiv.textContent = "";
      }
      if (!isEditable) this.elements.editableInputDiv.blur();
    }
  }

  /**
   * Checks if the input is currently in obscured mode.
   * @returns {boolean} True if input is obscured.
   */
  isObscured() {
    return this._isObscuredInputMode;
  }

  /**
   * Sets the flag indicating whether the user is navigating command history.
   * @param {boolean} status - The new status.
   */
  setIsNavigatingHistory(status) {
    this.isNavigatingHistory = status;
  }

  /**
   * Gets the flag indicating whether the user is navigating command history.
   * @returns {boolean} The current status.
   */
  getIsNavigatingHistory() {
    return this.isNavigatingHistory;
  }

  /**
   * Gets the start and end positions of the current text selection in the input field.
   * @returns {{start: number, end: number}} An object with the start and end offsets.
   */
  getSelection() {
    const sel = window.getSelection();
    let start, end;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (
          this.elements.editableInputDiv &&
          this.elements.editableInputDiv.contains(range.commonAncestorContainer)
      ) {
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(this.elements.editableInputDiv);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        start = preSelectionRange.toString().length;
        end = start + range.toString().length;
      } else {
        start = end = this.getCurrentInputValue().length;
      }
    } else {
      start = end = this.getCurrentInputValue().length;
    }
    return { start, end };
  }

  /**
   * Shows the terminal input line.
   */
  showInputLine() {
    if (this.elements.inputLineContainerDiv) {
      this.elements.inputLineContainerDiv.classList.remove(
          this.dependencies.Config.CSS_CLASSES.HIDDEN
      );
    }
  }

  /**
   * Hides the terminal input line.
   */
  hideInputLine() {
    if (this.elements.inputLineContainerDiv) {
      this.elements.inputLineContainerDiv.classList.add(
          this.dependencies.Config.CSS_CLASSES.HIDDEN
      );
    }
  }

  /**
   * Scrolls the terminal output to the bottom.
   */
  scrollOutputToEnd() {
    if (this.elements.outputDiv) {
      this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
    }
  }
  /**
   * Handles pasting text into the input field, supporting both normal and obscured modes.
   * @param {string} pastedText - The text to be pasted.
   */
  handlePaste(pastedText) {
    if (this.isObscured()) {
      const selection = this.getSelection();
      let { start, end } = selection;
      this.originalInputForObscure =
          this.originalInputForObscure.slice(0, start) +
          pastedText +
          this.originalInputForObscure.slice(end);
      this.elements.editableInputDiv.textContent = "*".repeat(
          this.originalInputForObscure.length
      );
      this.setCaretPosition(this.elements.editableInputDiv, start + pastedText.length);
    } else {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(pastedText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * @class TabCompletionManager
 * @classdesc Manages the logic for tab-completion of commands, paths, and other arguments.
 */
class TabCompletionManager {
  /**
   * Creates an instance of TabCompletionManager.
   */
  constructor() {
    /**
     * A cache of suggestions for the current completion cycle.
     * @type {string[]}
     */
    this.suggestionsCache = [];
    /**
     * The current index in the suggestions cache for cycling through options.
     * @type {number}
     */
    this.cycleIndex = -1;
    /**
     * The last input string for which completion was attempted.
     * @type {string|null}
     */
    this.lastCompletionInput = null;
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
  }

  /**
   * Sets the dependency injection container.
   * @param {object} injectedDependencies - The dependencies to be injected.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  /**
   * Resets the completion cycle state.
   */
  resetCycle() {
    this.suggestionsCache = [];
    this.cycleIndex = -1;
    this.lastCompletionInput = null;
  }

  /**
   * Finds the longest common prefix among an array of strings.
   * @param {string[]} strs - The array of strings.
   * @returns {string} The longest common prefix.
   */
  findLongestCommonPrefix(strs) {
    if (!strs || strs.length === 0) return "";
    if (strs.length === 1) return strs[0];
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === "") return "";
      }
    }
    return prefix;
  }

  /**
   * Analyzes the input string and cursor position to determine the context for completion.
   * @private
   * @param {string} fullInput - The full input string from the terminal.
   * @param {number} cursorPos - The current position of the caret.
   * @returns {object} An object describing the completion context.
   */
  _getCompletionContext(fullInput, cursorPos) {
    const tokens = fullInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const commandName = tokens.length > 0 ? tokens[0].replace(/["']/g, "") : "";
    const textBeforeCursor = fullInput.substring(0, cursorPos);
    let startOfWordIndex = 0;
    let inQuote = null;
    for (let i = 0; i < textBeforeCursor.length; i++) {
      const char = textBeforeCursor[i];
      if (inQuote && char === inQuote && textBeforeCursor[i - 1] !== "\\") {
        inQuote = null;
      } else if (
          !inQuote &&
          (char === '"' || char === "'") &&
          (i === 0 ||
              textBeforeCursor[i - 1] === " " ||
              textBeforeCursor[i - 1] === undefined)
      ) {
        inQuote = char;
      }
      if (char === " " && !inQuote) {
        startOfWordIndex = i + 1;
      }
    }
    const currentWordWithQuotes = fullInput.substring(
        startOfWordIndex,
        cursorPos
    );
    const quoteChar = currentWordWithQuotes.startsWith("'")
        ? "'"
        : currentWordWithQuotes.startsWith('"')
            ? '"'
            : null;
    const currentWordPrefix = quoteChar
        ? currentWordWithQuotes.substring(1)
        : currentWordWithQuotes;
    const isQuoted = !!quoteChar;
    const isCompletingCommand =
        tokens.length === 0 ||
        (tokens.length === 1 &&
            !fullInput.substring(0, tokens[0].length).includes(" "));
    return {
      commandName,
      isCompletingCommand,
      currentWordPrefix,
      startOfWordIndex,
      currentWordLength: currentWordWithQuotes.length,
      isQuoted,
      quoteChar,
    };
  }

  /**
   * Fetches completion suggestions based on the current context.
   * @private
   * @param {object} context - The completion context from _getCompletionContext.
   * @returns {Promise<string[]>} A promise that resolves to an array of suggestion strings.
   */
  async _getSuggestionsFromProvider(context) {
    const { currentWordPrefix, isCompletingCommand, commandName } = context;
    let suggestions = [];

    const { CommandExecutor, Config, StorageManager, FileSystemManager, UserManager } = this.dependencies;

    if (isCompletingCommand) {
      suggestions = Config.COMMANDS_MANIFEST.filter((cmd) =>
          cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
      ).sort();
    } else {

      const commandDefinition = await CommandExecutor._ensureCommandLoaded(commandName);
      if (!commandDefinition) return [];

      if (commandDefinition.definition.completionType === "commands") {
        suggestions = Config.COMMANDS_MANIFEST.filter((cmd) =>
            cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
        ).sort();
      } else if (commandDefinition.definition.completionType === "users") {
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        const userNames = Object.keys(users);
        if (!userNames.includes(Config.USER.DEFAULT_NAME))
          userNames.push(Config.USER.DEFAULT_NAME);
        suggestions = userNames
            .filter((name) =>
                name.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
            )
            .sort();
      } else if (
          commandDefinition.definition.completionType === "paths" ||
          commandDefinition.definition.pathValidation
      ) {
        const lastSlashIndex = currentWordPrefix.lastIndexOf(
            Config.FILESYSTEM.PATH_SEPARATOR
        );
        const pathPrefixForFS =
            lastSlashIndex !== -1
                ? currentWordPrefix.substring(0, lastSlashIndex + 1)
                : "";
        const segmentToMatchForFS =
            lastSlashIndex !== -1
                ? currentWordPrefix.substring(lastSlashIndex + 1)
                : currentWordPrefix;

        const effectiveBasePathForFS = FileSystemManager.getAbsolutePath(
            pathPrefixForFS,
            FileSystemManager.getCurrentPath()
        );
        const baseNode = FileSystemManager.getNodeByPath(
            effectiveBasePathForFS
        );
        const currentUser = UserManager.getCurrentUser().name;

        if (
            baseNode &&
            baseNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            FileSystemManager.hasPermission(baseNode, currentUser, "read")
        ) {
          suggestions = Object.keys(baseNode.children)
              .filter((name) =>
                  name.toLowerCase().startsWith(segmentToMatchForFS.toLowerCase())
              )
              .map((name) => pathPrefixForFS + name)
              .sort();
        }
      }
    }
    return suggestions;
  }

  /**
   * Handles the Tab key press to perform auto-completion.
   * @param {string} fullInput - The full current input string.
   * @param {number} cursorPos - The current cursor position.
   * @returns {Promise<object>} A promise resolving to an object with the text to insert and new cursor position.
   */
  async handleTab(fullInput, cursorPos) {
    const { FileSystemManager, OutputManager, TerminalUI } = this.dependencies;

    if (fullInput !== this.lastCompletionInput) {
      this.resetCycle();
    }

    const context = this._getCompletionContext(fullInput, cursorPos);

    const quoteIfNecessary = (text) => {
      if (/\s/.test(text)) {
        return `'${text}'`;
      }
      return text;
    };

    if (this.suggestionsCache.length === 0) {
      const suggestions = await this._getSuggestionsFromProvider(context);
      if (!suggestions || suggestions.length === 0) {
        this.resetCycle();
        return { textToInsert: null };
      }
      if (suggestions.length === 1) {
        const completion = suggestions[0];
        const completedNode = FileSystemManager.getNodeByPath(
            FileSystemManager.getAbsolutePath(completion)
        );
        const isDirectory =
            completedNode &&
            completedNode.type ===
            FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

        let finalCompletion = quoteIfNecessary(completion);
        finalCompletion += (isDirectory ? "/" : " ");

        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);

        let newText = textBefore + finalCompletion + textAfter;

        this.resetCycle();
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + finalCompletion).length,
        };
      }

      const lcp = this.findLongestCommonPrefix(suggestions);
      if (lcp && lcp.length > context.currentWordPrefix.length) {
        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);
        let newText = textBefore + lcp + textAfter;

        this.lastCompletionInput = newText;
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + lcp).length,
        };
      } else {
        this.suggestionsCache = suggestions;
        const promptText = `${TerminalUI.getPromptText()} `;
        void OutputManager.appendToOutput(`${promptText}${fullInput}`, {
          isCompletionSuggestion: true,
        });
        void OutputManager.appendToOutput(this.suggestionsCache.join("    "), {
          typeClass: "text-subtle",
          isCompletionSuggestion: true,
        });
        TerminalUI.scrollOutputToEnd();

        this.cycleIndex = 0;
        const firstSuggestion = this.suggestionsCache[this.cycleIndex];
        const completedNode = FileSystemManager.getNodeByPath(
            FileSystemManager.getAbsolutePath(firstSuggestion)
        );
        const isDirectory =
            completedNode &&
            completedNode.type ===
            FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);
        let completionText = quoteIfNecessary(firstSuggestion);
        completionText += (isDirectory ? "/" : " ");
        let newText = textBefore + completionText + textAfter;

        this.lastCompletionInput = newText;
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + completionText).length,
        };
      }
    } else {
      this.cycleIndex = (this.cycleIndex + 1) % this.suggestionsCache.length;
      const nextSuggestion = this.suggestionsCache[this.cycleIndex];
      const completedNode = FileSystemManager.getNodeByPath(
          FileSystemManager.getAbsolutePath(nextSuggestion)
      );
      const isDirectory =
          completedNode &&
          completedNode.type ===
          FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

      const textBefore = fullInput.substring(0, context.startOfWordIndex);
      const textAfter = fullInput.substring(cursorPos);
      let completionText = quoteIfNecessary(nextSuggestion);
      completionText += (isDirectory ? "/" : " ");
      let newText = textBefore + completionText + textAfter;

      this.lastCompletionInput = newText;
      return {
        textToInsert: newText,
        newCursorPos: (textBefore + completionText).length,
      };
    }
  }
}

/**
 * @class AppLayerManager
 * @classdesc Manages the display and lifecycle of full-screen applications
 * that overlay the main terminal interface.
 */
class AppLayerManager {
  /**
   * Creates an instance of AppLayerManager.
   */
  constructor() {
    /**
     * A cached reference to the application layer DOM element.
     * @type {HTMLElement|null}
     */
    this.cachedAppLayer = null;
    /**
     * The currently active application instance.
     * @type {App|null}
     */
    this.activeApp = null;
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
    /**
     * A bound reference to the global keydown handler for easy removal.
     * @type {Function}
     * @private
     */
    this._boundHandleGlobalKeyDown = this._handleGlobalKeyDown.bind(this);
  }

  /**
   * Initializes the AppLayerManager with a reference to the app layer DOM element.
   * @param {object} dom - An object containing references to core DOM elements.
   */
  initialize(dom) {
    this.cachedAppLayer = dom.appLayer;
  }

  /**
   * Sets the dependency injection container.
   * @param {object} injectedDependencies - The dependencies to be injected.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  /**
   * Handles global keydown events and forwards them to the active application.
   * @private
   * @param {KeyboardEvent} event - The keyboard event.
   */
  _handleGlobalKeyDown(event) {
    if (this.activeApp && typeof this.activeApp.handleKeyDown === "function") {
      this.activeApp.handleKeyDown(event);
    }
  }

  /**
   * Shows a full-screen application, hiding the terminal input.
   * @param {App} appInstance - An instance of a class that extends the base App.
   * @param {object} [options={}] - Options to pass to the application's `enter` method.
   */
  show(appInstance, options = {}) {
    const { TerminalUI, OutputManager } = this.dependencies;
    if (!(appInstance instanceof App)) {
      console.error(
          "AppLayerManager: Attempted to show an object that is not an instance of App."
      );
      return;
    }

    if (this.activeApp) {
      this.activeApp.exit();
    }

    this.activeApp = appInstance;

    appInstance.enter(this.cachedAppLayer, options);

    this.cachedAppLayer.classList.remove("hidden");
    document.addEventListener("keydown", this._boundHandleGlobalKeyDown, true);

    TerminalUI.setInputState(false);
    OutputManager.setEditorActive(true);

    if (
        appInstance.container &&
        typeof appInstance.container.focus === "function"
    ) {
      appInstance.container.focus();
    }
  }

  /**
   * Hides the currently active application and restores the terminal input.
   * @param {App} appInstance - The application instance that is requesting to be hidden.
   */
  hide(appInstance) {
    const { TerminalUI, OutputManager } = this.dependencies;
    if (this.activeApp !== appInstance) {
      return;
    }

    if (
        appInstance.container &&
        appInstance.container.parentNode === this.cachedAppLayer
    ) {
      this.cachedAppLayer.removeChild(appInstance.container);
    }
    this.cachedAppLayer.classList.add("hidden");
    document.removeEventListener("keydown", this._boundHandleGlobalKeyDown, true);

    this.activeApp = null;

    TerminalUI.showInputLine();
    TerminalUI.setInputState(true);
    OutputManager.setEditorActive(false);
    TerminalUI.focusInput();
  }

  /**
   * Checks if an application is currently active.
   * @returns {boolean} True if an app is active, false otherwise.
   */
  isActive() {
    return !!this.activeApp;
  }
}