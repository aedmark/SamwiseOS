// scripts/ai_manager.js

class AIManager {
    constructor() {
        this.dependencies = {};
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    async getApiKey(provider, options = {}) {
        const {StorageManager, ModalManager, OutputManager, Config} = this.dependencies;
        if (provider !== "gemini") {
            return {success: true, data: {key: null}};
        }

        const key = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
        if (key) {
            return {success: true, data: {key, fromStorage: true}};
        }

        if (!options.isInteractive) {
            return {
                success: false,
                error: "A Gemini API key is required. Please run `gemini` once in an interactive terminal to set it up.",
            };
        }

        return new Promise((resolve) => {
            ModalManager.request({
                context: "terminal",
                type: "input",
                messageLines: ["Please enter your Gemini API key:"],
                obscured: true,
                onConfirm: (providedKey) => {
                    if (!providedKey || providedKey.trim() === "") {
                        resolve({
                            success: false,
                            error: "API key entry cancelled or empty.",
                        });
                        return;
                    }
                    StorageManager.saveItem(
                        Config.STORAGE_KEYS.GEMINI_API_KEY,
                        providedKey,
                        "Gemini API Key"
                    );
                    OutputManager.appendToOutput("API Key saved.", {
                        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                    });
                    resolve({
                        success: true,
                        data: {
                            key: providedKey,
                            fromStorage: false,
                        },
                    });
                },
                onCancel: () => {
                    resolve({success: false, error: "API key entry cancelled."});
                },
                options,
            });
        });
    }
}