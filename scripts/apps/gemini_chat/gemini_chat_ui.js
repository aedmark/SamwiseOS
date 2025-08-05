/**
 * Gemini Chat UI - Manages the visual interface for the Gemini Chat application.
 * @class GeminiChatUI
 */
window.GeminiChatUI = class GeminiChatUI {
  /**
   * Constructs a new GeminiChatUI instance.
   * @param {object} callbacks - An object containing callback functions for user interactions.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(callbacks, dependencies) {
    /** @type {object} A cache of DOM elements for the UI. */
    this.elements = {};
    /** @type {object} Callback functions for UI events. */
    this.managerCallbacks = callbacks;
    /** @type {object} The dependency injection container. */
    this.dependencies = dependencies;
    this._buildLayout();
  }

  /**
   * Returns the main container element of the chat application.
   * @returns {HTMLElement} The root DOM element.
   */
  getContainer() {
    return this.elements.container;
  }

  /**
   * Builds the main UI layout, including the message display and input form.
   * @private
   */
  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('Gemini Chat', this.managerCallbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;
    this.elements.footer = appWindow.footer;

    this.elements.messageDisplay = Utils.createElement("div", {
      className: "gemini-chat-messages",
    });
    this.elements.loader = Utils.createElement(
        "div",
        { className: "gemini-chat-loader hidden" },
        [
          Utils.createElement("span"),
          Utils.createElement("span"),
          Utils.createElement("span"),
        ]
    );

    this.elements.main.append(this.elements.messageDisplay, this.elements.loader);

    this.elements.input = Utils.createElement("input", {
      type: "text",
      placeholder: "Type your message...",
      className: "gemini-chat-input",
    });
    const sendBtn = Utils.createElement("button", {
      className: "btn btn--confirm",
      textContent: "Send",
    });
    const form = Utils.createElement(
        "form",
        { className: "gemini-chat-form" },
        [this.elements.input, sendBtn]
    );

    this.elements.footer.appendChild(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.managerCallbacks.onSendMessage(this.elements.input.value);
      this.elements.input.value = "";
    });
    this.elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    this.elements.input.focus();
  }

  /**
   * Hides the chat application and cleans up its DOM elements.
   */
  hideAndReset() {
    if (this.elements.container) {
      this.elements.container.remove();
    }
    this.elements = {};
    this.managerCallbacks = {};
  }

  /**
   * Appends a new message to the chat display.
   * @param {string} message - The message text.
   * @param {string} sender - The sender of the message ('user' or 'ai').
   * @param {boolean} processMarkdown - Whether to render the message as Markdown.
   */
  appendMessage(message, sender, processMarkdown) {
    if (!this.elements.messageDisplay) return;
    const { Utils } = this.dependencies;

    const messageDiv = Utils.createElement("div", {
      className: `gemini-chat-message ${sender}`,
    });

    if (processMarkdown) {
      const sanitizedHtml = DOMPurify.sanitize(marked.parse(message));
      // Use createTextNode and appendChild instead of innerHTML
      const textNode = document.createTextNode(sanitizedHtml);
      messageDiv.appendChild(textNode);

      const copyBtn = Utils.createElement("button", {
        className: "btn",
        style: "position: absolute; top: 5px; right: 5px; font-size: 0.75rem; padding: 2px 5px;",
        textContent: "Copy",
      });
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message);
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        } catch (err) {
          console.error("Failed to copy text:", err);
          copyBtn.textContent = "Error!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        }
      });
      messageDiv.style.position = "relative";
      messageDiv.appendChild(copyBtn);

      messageDiv.querySelectorAll("pre > code").forEach((codeBlock) => {
        const commandText = codeBlock.textContent.trim();
        if (!commandText.includes("\n")) {
          const runButton = Utils.createElement("button", {
            className: "btn btn--confirm",
            textContent: `Run Command`,
            style: "display: block; margin-top: 10px;",
          });
          runButton.addEventListener("click", () =>
              this.managerCallbacks.onRunCommand(commandText)
          );
          codeBlock.parentElement.insertAdjacentElement("afterend", runButton);
        }
      });
    } else {
      messageDiv.textContent = message;
    }

    this.elements.messageDisplay.appendChild(messageDiv);
    this.elements.messageDisplay.scrollTop = this.elements.messageDisplay.scrollHeight;
  }

  /**
   * Toggles the visibility of the loading indicator.
   * @param {boolean} show - Whether to show or hide the loader.
   */
  toggleLoader(show) {
    if (this.elements.loader) {
      this.elements.loader.classList.toggle("hidden", !show);
    }
  }
};