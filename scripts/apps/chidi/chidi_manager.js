// scripts/apps/chidi/chidi_manager.js

window.ChidiManager = class ChidiManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
    }

    enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();

        this._initializeState(options.initialFiles, options.launchOptions);
        this.isActive = true;

        this.ui = new this.dependencies.ChidiUI(this.state, this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        const initialMessage = this.state.isNewSession
            ? `New session started. Analyzing ${this.state.loadedFiles.length} files.`
            : `Chidi.md initialized. Analyzing ${this.state.loadedFiles.length} files.`;
        this.ui.showMessage(initialMessage, true);
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

    _initializeState(initialFiles, launchOptions) {
        const { Utils } = this.dependencies;
        this.state = {
            isActive: true,
            loadedFiles: initialFiles.map((file) => ({
                ...file,
                isCode: ["js", "sh"].includes(Utils.getFileExtension(file.name)),
            })),
            currentIndex: initialFiles.length > 0 ? 0 : -1,
            isNewSession: launchOptions.isNewSession,
            provider: launchOptions.provider || "gemini",
            model: launchOptions.model || null,
            conversationHistory: [],
            sessionContext: initialFiles
                .map(
                    (file) =>
                        `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT ---`
                )
                .join("\n\n"),
        };

        if (launchOptions.isNewSession) {
            this.state.conversationHistory = [];
        }
    }

    async _callPythonKernelForAnalysis(analysisType, context, question = null) {
        const { ErrorHandler, AIManager } = this.dependencies;

        const apiKeyResult = await AIManager.getApiKey(this.state.provider, { isInteractive: true, dependencies: this.dependencies });
        if (!apiKeyResult.success) return { success: false, error: apiKeyResult.error };

        const jsContext = {
            api_key: apiKeyResult.data.key,
            provider: this.state.provider,
            model: this.state.model
        };

        // Using the backward-compatible stub is sufficient here.
        const resultJson = OopisOS_Kernel.chidi_analysis(JSON.stringify(jsContext), context, analysisType, question);

        try {
            const result = JSON.parse(resultJson);
            return result.success ? { success: true, answer: result.data } : { success: false, error: result.error };
        } catch (e) {
            return ErrorHandler.createError(`Failed to communicate with Python kernel: ${e.message}`);
        }
    }

    _createCallbacks() {
        return {
            onPrevFile: () => {
                if (this.state.currentIndex > 0) {
                    this.state.currentIndex--;
                    this.ui.update(this.state);
                }
            },
            onNextFile: () => {
                if (this.state.currentIndex < this.state.loadedFiles.length - 1) {
                    this.state.currentIndex++;
                    this.ui.update(this.state);
                }
            },
            onAsk: async () => {
                const { ModalManager, Config } = this.dependencies;
                const userQuestion = await new Promise((resolve) => {
                    ModalManager.request({
                        context: "graphical",
                        type: "input",
                        messageLines: ["Ask a question about all loaded documents:"],
                        onConfirm: (value) => resolve(value),
                        onCancel: () => resolve(null),
                    });
                });

                if (!userQuestion || !userQuestion.trim()) return;

                this.ui.toggleLoader(true);
                const randomMessage = Config.MESSAGES.AI_LOADING_MESSAGES[Math.floor(Math.random() * Config.MESSAGES.AI_LOADING_MESSAGES.length)];
                this.ui.showMessage(randomMessage);


                const result = await this._callPythonKernelForAnalysis(
                    'ask',
                    this.state.sessionContext,
                    userQuestion
                );

                this.ui.toggleLoader(false);
                if (result.success) {
                    this.ui.appendAiOutput(`Answer for "${userQuestion}"`, result.answer);
                    this.ui.showMessage("Response received.", true);
                } else {
                    if (result.error && result.error.toLowerCase().includes("api key")) {
                        this.ui.appendAiOutput("API Error", "Looks like we're missing the secret handshake (API key). Try running 'gemini' in the terminal to set it up!");
                    } else {
                        this.ui.appendAiOutput(
                            "API Error",
                            `Failed to get a response. Details: ${result.error}`
                        );
                    }
                    this.ui.showMessage(`Error: ${result.error}`, true);
                }
            },
            onSummarize: async () => {
                const { Utils, Config } = this.dependencies;
                const currentFile = this.state.loadedFiles[this.state.currentIndex];
                if (!currentFile) return;
                this.ui.toggleLoader(true);
                const randomMessage = Config.MESSAGES.AI_LOADING_MESSAGES[Math.floor(Math.random() * Config.MESSAGES.AI_LOADING_MESSAGES.length)];
                this.ui.showMessage(randomMessage);

                let contentToSummarize = currentFile.content;
                if (currentFile.isCode) {
                    const comments = Utils.extractComments(
                        currentFile.content,
                        Utils.getFileExtension(currentFile.name)
                    );
                    if (comments && comments.trim() !== "") {
                        contentToSummarize = comments;
                    }
                }

                const result = await this._callPythonKernelForAnalysis(
                    'summarize',
                    contentToSummarize
                );

                this.ui.toggleLoader(false);
                if (result.success) {
                    this.ui.appendAiOutput("Summary", result.answer);
                    this.ui.showMessage("Summary received.", true);
                } else {
                    if (result.error && result.error.toLowerCase().includes("api key")) {
                        this.ui.appendAiOutput("API Error", "Looks like we're missing the secret handshake (API key). Try running 'gemini' in the terminal to set it up!");
                    } else {
                        this.ui.appendAiOutput(
                            "API Error",
                            `Failed to get a summary. Details: ${result.error}`
                        );
                    }
                    this.ui.showMessage(`Error: ${result.error}`, true);
                }
            },
            onStudy: async () => {
                const { Utils, Config } = this.dependencies;
                const currentFile = this.state.loadedFiles[this.state.currentIndex];
                if (!currentFile) return;
                this.ui.toggleLoader(true);
                const randomMessage = Config.MESSAGES.AI_LOADING_MESSAGES[Math.floor(Math.random() * Config.MESSAGES.AI_LOADING_MESSAGES.length)];
                this.ui.showMessage(randomMessage);
                let contentForQuestions = currentFile.content;
                if (currentFile.isCode) {
                    const comments = Utils.extractComments(
                        currentFile.content,
                        Utils.getFileExtension(currentFile.name)
                    );
                    if (comments && comments.trim() !== "") {
                        contentForQuestions = comments;
                    }
                }

                const result = await this._callPythonKernelForAnalysis(
                    'study',
                    contentForQuestions
                );

                this.ui.toggleLoader(false);
                if (result.success) {
                    this.ui.appendAiOutput("Suggested Questions", result.answer);
                    this.ui.showMessage("Suggestions received.", true);
                } else {
                    if (result.error && result.error.toLowerCase().includes("api key")) {
                        this.ui.appendAiOutput("API Error", "Looks like we're missing the secret handshake (API key). Try running 'gemini' in the terminal to set it up!");
                    } else {
                        this.ui.appendAiOutput(
                            "API Error",
                            `Failed to get suggestions. Details: ${result.error}`
                        );
                    }
                    this.ui.showMessage(`Error: ${result.error}`, true);
                }
            },
            onSaveSession: async () => {
                const { ModalManager, FileSystemManager, UserManager } = this.dependencies;
                const filename = await new Promise((resolve) => {
                    ModalManager.request({
                        context: "graphical",
                        type: "input",
                        messageLines: ["Save Chidi Session As:"],
                        placeholder: `chidi_session_${new Date().toISOString().split("T")[0]}.html`,
                        onConfirm: (value) => resolve(value.trim()),
                        onCancel: () => resolve(null),
                    });
                });
                if (!filename) return;

                const htmlContent = this.ui.packageSessionAsHTML(this.state);
                const absPath = FileSystemManager.getAbsolutePath(filename);
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    absPath,
                    htmlContent,
                    {
                        currentUser: UserManager.getCurrentUser().name,
                        primaryGroup: UserManager.getPrimaryGroupForUser(
                            UserManager.getCurrentUser().name
                        ),
                    }
                );
                if (saveResult.success && (await FileSystemManager.save())) {
                    this.ui.showMessage(`Session saved to '${filename}'.`, true);
                } else {
                    this.ui.showMessage(
                        `Error: ${saveResult.error || "Failed to save file system."}`,
                        true
                    );
                }
            },
            onExport: () => {
                const { Utils } = this.dependencies;
                const htmlContent = this.ui.packageSessionAsHTML(this.state);
                const currentFile = this.state.loadedFiles[this.state.currentIndex];
                const blob = new Blob([htmlContent], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = Utils.createElement("a", {
                    href: url,
                    download: `${currentFile.name.replace(/\.(md|txt|html)$/, "")}_session.html`,
                });
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.ui.showMessage(`Exported session for ${currentFile.name}.`, true);
            },
            onClose: this.exit.bind(this),
        };
    }
}