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
                const { AIManager } = this.dependencies;
                if (!userInput || userInput.trim() === "") return;

                this.ui.appendMessage(userInput, "user", false);
                this.state.conversationHistory.push({
                    role: "user",
                    parts: [{ text: userInput }],
                });

                this.ui.toggleLoader(true);

                const apiKeyResult = await AIManager.getApiKey(this.state.provider, { isInteractive: true, dependencies: this.dependencies });
                if (!apiKeyResult.success) {
                    this.ui.toggleLoader(false);
                    this.ui.appendMessage(`API Key Error: ${apiKeyResult.error}`, "ai", true);
                    this.state.conversationHistory.pop(); // Remove the user message that failed
                    return;
                }

                const options = { apiKey: apiKeyResult.data.key };

                const resultJson = await OopisOS_Kernel.syscall("ai", "perform_agentic_search", [
                    userInput,
                    this.state.conversationHistory,
                    this.state.provider,
                    this.state.model,
                    options
                ]);
                const agentResult = JSON.parse(resultJson);


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