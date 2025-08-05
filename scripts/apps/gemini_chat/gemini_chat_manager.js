/**
 * Gemini Chat Manager - Manages the state and logic for the Gemini Chat application.
 * @class GeminiChatManager
 * @extends App
 */
window.GeminiChatManager = class GeminiChatManager extends App {
  /**
   * Constructs a new GeminiChatManager instance.
   */
  constructor() {
    super();
    /** @type {object} The application's internal state. */
    this.state = {};
    /** @type {object} The dependency injection container. */
    this.dependencies = {};
    /** @type {object} A collection of UI callback functions. */
    this.callbacks = {};
    /** @type {GeminiChatUI|null} The UI component instance. */
    this.ui = null;
  }

  /**
   * Initializes and displays the Gemini Chat application.
   * @param {HTMLElement} appLayer - The DOM element to append the app's UI to.
   * @param {object} [options={}] - Options for entering the application.
   * @param {string} [options.provider] - The AI provider to use (e.g., "gemini", "ollama").
   * @param {string} [options.model] - The specific model to use for the provider.
   * @returns {Promise<void>}
   */
  async enter(appLayer, options = {}) {
    if (this.isActive) return;

    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();

    this.isActive = true;
    this.state = {
      isActive: true,
      conversationHistory: [],
      provider: options.provider || "gemini",
      model: options.model || null,
      options,
      terminalContext: "",
    };

    this.ui = new this.dependencies.GeminiChatUI(this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    appLayer.appendChild(this.container);

    this.ui.appendMessage(
        "Greetings! What would you like to do?",
        "ai",
        true
    );

    this.container.focus();
  }

  /**
   * Exits the Gemini Chat application, cleaning up UI and state.
   */
  exit() {
    if (!this.isActive) return;
    if (this.ui) {
      this.ui.hideAndReset();
    }
    this.dependencies.AppLayerManager.hide(this);
    this.isActive = false;
    this.state = {};
    this.ui = null;
  }

  /**
   * Handles keyboard events for the application.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  handleKeyDown(event) {
    if (event.key === "Escape") {
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
      /**
       * Callback to handle sending a new message from the user.
       * It sends the message to the AI and updates the UI with the response.
       * @param {string} userInput - The message text from the user.
       */
      onSendMessage: async (userInput) => {
        const { AIManager } = this.dependencies;
        if (!userInput || userInput.trim() === "") return;

        this.ui.appendMessage(userInput, "user", false);
        this.state.conversationHistory.push({
          role: "user",
          parts: [{ text: userInput }],
        });

        this.ui.toggleLoader(true);

        const verboseCallback = (message, typeClass) => {
          this.ui.appendMessage(message, "system", false);
        };

        const agentResult = await AIManager.performAgenticSearch(
            userInput,
            this.state.conversationHistory,
            this.state.provider,
            this.state.model,
            { isInteractive: true, ...this.state.options, verboseCallback, dependencies: this.dependencies }
        );

        this.ui.toggleLoader(false);

        if (agentResult.success) {
          const finalAnswer = agentResult.data;
          this.state.conversationHistory.push({
            role: "model",
            parts: [{ text: finalAnswer }],
          });
          this.ui.appendMessage(finalAnswer, "ai", true);
        } else {
          this.ui.appendMessage(
              `An error occurred: ${agentResult.error}`,
              "ai",
              true
          );
          this.state.conversationHistory.pop();
        }
      },
      /**
       * Callback to exit the application.
       */
      onExit: this.exit.bind(this),
      /**
       * Callback to run a command provided by the AI in the main terminal.
       * @param {string} commandText - The command string to execute.
       */
      onRunCommand: async (commandText) => {
        const { CommandExecutor } = this.dependencies;
        this.exit();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await CommandExecutor.processSingleCommand(commandText, {
          isInteractive: true,
        });
      },
    };
  }
};