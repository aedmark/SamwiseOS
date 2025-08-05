// scripts/modal_manager.js

/**
 * Manages all modal-style user interactions, whether in the graphical
 * app layer or directly within the terminal output. It handles confirmations,
 * inputs (including obscured passwords), and user prompts.
 * @class ModalManager
 */
class ModalManager {
  /**
   * @constructor
   */
  constructor() {
    /**
     * Flag indicating if the manager is currently waiting for input from the terminal.
     * @type {boolean}
     */
    this.isAwaitingTerminalInput = false;
    /**
     * The context of the currently active modal interaction.
     * @type {object|null}
     */
    this.activeModalContext = null;
    /**
     * A cached reference to the terminal bezel DOM element.
     * @type {HTMLElement|null}
     */
    this.cachedTerminalBezel = null;
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
  }

  /**
   * Initializes the ModalManager with a reference to the terminal's main DOM elements.
   * @param {object} dom - An object containing references to core DOM elements.
   */
  initialize(dom) {
    this.cachedTerminalBezel = dom.terminalBezel;
  }

  /**
   * Sets the dependency injection container.
   * @param {object} injectedDependencies - The dependencies to be injected.
   */
  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  /**
   * Creates and displays a graphical modal dialog.
   * @private
   * @param {object} options - Options for configuring the modal.
   */
  _createModalDOM(options) {
    const {
      messageLines,
      onConfirm,
      onCancel,
      type,
      confirmText = "OK",
      cancelText = "Cancel",
      placeholder = "",
      obscured = false,
      data = {},
    } = options;
    const { Utils } = this.dependencies;

    if (!this.cachedTerminalBezel) {
      console.error(
          "ModalManager: Cannot find terminal-bezel to attach modal."
      );
      if (onCancel) onCancel(data);
      return;
    }

    const removeModal = () => {
      const modal = document.getElementById("dynamic-modal-dialog");
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    };

    const confirmHandler = () => {
      removeModal();
      if (onConfirm) {
        const value = inputField ? inputField.value : null;
        onConfirm(value, data);
      }
    };

    const cancelHandler = () => {
      removeModal();
      if (onCancel) onCancel(data);
    };

    const confirmButton = Utils.createElement("button", {
      className: "btn btn--confirm",
      textContent: confirmText,
      eventListeners: { click: confirmHandler }
    });

    const cancelButton = Utils.createElement("button", {
      className: "btn btn--cancel",
      textContent: cancelText,
      eventListeners: { click: cancelHandler }
    });

    let inputField = null;
    if (type === "input") {
      inputField = Utils.createElement("input", {
        type: obscured ? "password" : "text",
        placeholder: placeholder,
        className: "modal-dialog__input",
        eventListeners: {
          keydown: (e) => {
            if (e.key === "Enter") {
              confirmHandler();
            } else if (e.key === "Escape") {
              cancelHandler();
            }
          }
        }
      });
    }

    const buttonContainer = Utils.createElement(
        "div",
        { className: "modal-dialog__buttons" },
        [confirmButton, cancelButton]
    );
    const messageContainer = Utils.createElement("div");
    messageLines.forEach((line) => {
      messageContainer.appendChild(
          Utils.createElement("p", { textContent: line })
      );
    });

    const modalDialogContents = [messageContainer];
    if (inputField) {
      modalDialogContents.push(inputField);
    }
    modalDialogContents.push(buttonContainer);

    const modalDialog = Utils.createElement(
        "div",
        { className: "modal-dialog" },
        modalDialogContents
    );
    const modalOverlay = Utils.createElement(
        "div",
        { id: "dynamic-modal-dialog", className: "modal-overlay" },
        [modalDialog]
    );

    this.cachedTerminalBezel.appendChild(modalOverlay);

    if (inputField) {
      inputField.focus();
    }
  }

  /**
   * Renders a modal-like prompt directly in the terminal output, awaiting the next input.
   * @private
   * @param {object} options - Options for the terminal prompt.
   */
  _renderTerminalPrompt(options) {
    const { messageLines, onConfirm, onCancel, type, obscured, data } = options;
    const { OutputManager, TerminalUI, Config } = this.dependencies;

    if (this.isAwaitingTerminalInput) {
      if (onCancel) onCancel(data);
      return;
    }
    this.isAwaitingTerminalInput = true;
    this.activeModalContext = { onConfirm, onCancel, data, type, obscured };
    messageLines.forEach(
        (line) =>
            void OutputManager.appendToOutput(line, { typeClass: Config.CSS_CLASSES.WARNING_MSG })
    );

    if (type === "confirm") {
      void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      });
    }

    TerminalUI.showInputLine();
    TerminalUI.setInputState(true, obscured);
    TerminalUI.focusInput();
    TerminalUI.clearInput();
    TerminalUI.scrollOutputToEnd();
  }

  /**
   * Requests a user interaction, dispatching to either a graphical modal or a terminal prompt.
   * @param {object} options - Options for the user interaction.
   */
  request(options) {
    const { OutputManager, TerminalUI, Config } = this.dependencies;
    const finalOptions = {
      type: "confirm",
      context: "terminal",
      ...options,
    };
    const { context, type } = finalOptions;

    if (
        finalOptions.options?.scriptingContext?.isScripting ||
        finalOptions.options?.stdinContent
    ) {
      const scriptContext = finalOptions.options.scriptingContext;
      let inputLine = null;

      if (finalOptions.options.stdinContent) {
        inputLine = finalOptions.options.stdinContent.trim().split("\\n")[0];
      } else if (scriptContext) {
        let nextLineIndex = scriptContext.currentLineIndex + 1;
        while (nextLineIndex < scriptContext.lines.length) {
          const line = scriptContext.lines[nextLineIndex].trim();
          if (line && !line.startsWith("#")) {
            inputLine = line;
            scriptContext.currentLineIndex = nextLineIndex;
            break;
          }
          nextLineIndex++;
        }
      }

      if (inputLine !== null) {
        finalOptions.messageLines.forEach(
            (line) =>
                void OutputManager.appendToOutput(line, {
                  typeClass: Config.CSS_CLASSES.WARNING_MSG,
                })
        );
        if (type === "confirm") {
          void OutputManager.appendToOutput(
              Config.MESSAGES.CONFIRMATION_PROMPT,
              { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
          );
        }
        const promptEcho = `${TerminalUI.getPromptText()}`;
        const echoInput = finalOptions.obscured
            ? "*".repeat(inputLine.length)
            : inputLine;
        void OutputManager.appendToOutput(`${promptEcho}${echoInput}`);

        if (type === "confirm") {
          if (inputLine.toUpperCase() === "YES") {
            if (finalOptions.onConfirm)
              finalOptions.onConfirm(finalOptions.data);
          } else {
            if (finalOptions.onCancel) finalOptions.onCancel(finalOptions.data);
          }
        } else {
          if (finalOptions.onConfirm)
            finalOptions.onConfirm(inputLine, finalOptions.data);
        }
      } else {
        if (finalOptions.onCancel) finalOptions.onCancel(finalOptions.data);
      }
      return;
    }

    if (context === "graphical") {
      this._createModalDOM(finalOptions);
    } else {
      this._renderTerminalPrompt(finalOptions);
    }
  }

  /**
   * Handles user input from the terminal when the manager is in an awaiting state.
   * @param {string} input - The raw user input from the terminal.
   * @returns {Promise<boolean>} A promise that resolves to true if input was handled.
   */
  async handleTerminalInput(input) {
    if (!this.isAwaitingTerminalInput) return false;

    const { onConfirm, onCancel, data, type, obscured } = this.activeModalContext;
    const { OutputManager, TerminalUI, Config } = this.dependencies;

    const promptString = `${TerminalUI.getPromptText()}`;
    const echoInput = obscured ? "*".repeat(input.length) : input.trim();
    await OutputManager.appendToOutput(`${promptString}${echoInput}`);

    this.isAwaitingTerminalInput = false;
    this.activeModalContext = null;
    TerminalUI.setInputState(true, false);
    TerminalUI.clearInput();

    if (type === "confirm") {
      if (input.trim().toUpperCase() === "YES") {
        if (onConfirm) await onConfirm(data);
      } else {
        if (onCancel) {
          await onCancel(data);
        } else {
          await OutputManager.appendToOutput(
              Config.MESSAGES.OPERATION_CANCELLED,
              { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
          );
        }
      }
    } else {
      if (onConfirm) await onConfirm(input, data);
    }

    return true;
  }

  /**
   * Checks if the manager is currently awaiting input from the terminal.
   * @returns {boolean} True if awaiting input, false otherwise.
   */
  isAwaiting() {
    return this.isAwaitingTerminalInput;
  }
}