window.GeminiChatManager = class GeminiChatManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
    }

    async enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();

        this.isActive = true;
        this.state = {
            isActive: true,
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

    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.exit();
        }
    }

    _createCallbacks() {
        return {
            onSendMessage: async (userInput) => {
                const { CommandExecutor } = this.dependencies;
                if (!userInput || userInput.trim() === "") return;

                this.ui.appendMessage(userInput, "user", false);
                this.ui.toggleLoader(true);

                const command = `gemini --chat-internal "${userInput}"`;
                const result = await CommandExecutor.processSingleCommand(command, { isInteractive: false });

                this.ui.toggleLoader(false);

                if (result.success) {
                    this.ui.appendMessage(result.output, "ai", true);
                } else {
                    this.ui.appendMessage(
                        `An error occurred: ${result.error}`,
                        "ai",
                        true
                    );
                }
            },
            onExit: this.exit.bind(this),
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