/**
 * Log Manager - Manages the state and logic for the Log (journal) application.
 * All core logic is now delegated to the Python kernel.
 * @class LogManager
 * @extends App
 */

window.LogManager = class LogManager extends App {
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
        this.state = { allEntries: [], filteredEntries: [], selectedPath: null, isDirty: false, };
        this.ui = new this.dependencies.LogUI(this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        const ensureResult = JSON.parse(await OopisOS_Kernel.syscall("log", "ensure_log_dir", [this._getContext()]));
        if (!ensureResult.success) {
            console.error("Log App Error:", ensureResult.error);
            this.exit();
            return;
        }

        await this._loadEntries();
        this.ui.renderEntries(this.state.filteredEntries, null);
        this.ui.renderContent(null);
    }

    _getContext() {
        return { name: this.dependencies.UserManager.getCurrentUser().name };
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager, ModalManager } = this.dependencies;
        const performExit = () => {
            if (this.ui) {
                this.ui.reset();
            }
            AppLayerManager.hide(this);
            this.isActive = false;
            this.state = {};
            this.ui = null;
        };

        if (this.state.isDirty) {
            ModalManager.request({
                context: "graphical",
                type: "confirm",
                messageLines: [
                    "You have unsaved changes that will be lost.",
                    "Exit without saving?",
                ],
                onConfirm: performExit,
                onCancel: () => { },
            });
        } else {
            performExit();
        }
    }

    async handleKeyDown(event) {
        if (!this.isActive) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            await this.callbacks.onSave();
        } else if (event.key === "Escape") {
            this.exit();
        }
    }

    _createCallbacks() {
        return {
            onExit: this.exit.bind(this),
            onSearch: (query) => {
                this.state.filteredEntries = this.state.allEntries.filter((e) =>
                    e.content.toLowerCase().includes(query.toLowerCase())
                );
                this.ui.renderEntries(
                    this.state.filteredEntries,
                    this.state.selectedPath
                );
            },
            onSelect: async (path) => {
                const { ModalManager } = this.dependencies;
                if (this.state.isDirty) {
                    const confirmed = await new Promise((r) =>
                        ModalManager.request({
                            context: "graphical",
                            type: "confirm",
                            messageLines: ["You have unsaved changes. Discard them?"],
                            onConfirm: () => r(true),
                            onCancel: () => r(false),
                        })
                    );
                    if (!confirmed) return;
                }
                this.state.selectedPath = path;
                const selectedEntry = this.state.allEntries.find(
                    (e) => e.path === path
                );
                this.ui.renderContent(selectedEntry);
                this.ui.renderEntries(
                    this.state.filteredEntries,
                    this.state.selectedPath
                );
                this.state.isDirty = false;
                this.ui.updateSaveButton(false);
            },
            onNew: async () => {
                // 'log <entry>' command now handles quick-add, so we just re-load
                const { ModalManager, CommandExecutor } = this.dependencies;
                const title = await new Promise((resolve) =>
                    ModalManager.request({
                        context: "graphical",
                        type: "input",
                        messageLines: ["Enter New Log Title:"],
                        placeholder: "A new beginning...",
                        onConfirm: (value) => resolve(value),
                        onCancel: () => resolve(null),
                    })
                );
                if (title) {
                    const newContent = `# ${title}`;
                    // Use the 'log' command for quick-add
                    await CommandExecutor.processSingleCommand(`log "${newContent}"`, { isInteractive: false });
                    await this._loadEntries();
                    // Find the newest entry and select it
                    if (this.state.allEntries.length > 0) {
                        const newestPath = this.state.allEntries[0].path;
                        await this.callbacks.onSelect(newestPath);
                    }
                }
            },

            onSave: async () => {
                if (!this.state.selectedPath || !this.state.isDirty) return;
                const newContent = this.ui.getContent();
                const resultJson = await OopisOS_Kernel.syscall("log", "save_entry", [this.state.selectedPath, newContent, this._getContext()]);
                const result = JSON.parse(resultJson);

                if (result.success) {
                    const entryIndex = this.state.allEntries.findIndex((e) => e.path === this.state.selectedPath);
                    if (entryIndex > -1) this.state.allEntries[entryIndex].content = newContent;
                    this.state.isDirty = false;
                    this.ui.updateSaveButton(false);
                } else {
                    alert(`Error saving: ${result.error}`);
                }
            },
            onContentChange: () => {
                const selectedEntry = this.state.allEntries.find(
                    (e) => e.path === this.state.selectedPath
                );
                if (!selectedEntry) return;
                const newContent = this.ui.getContent();
                this.state.isDirty = newContent !== selectedEntry.content;
                this.ui.updateSaveButton(this.state.isDirty);
            },
        };
    }

    async _loadEntries() {
        const resultJson = await OopisOS_Kernel.syscall("log", "load_entries", [this._getContext()]);
        const result = JSON.parse(resultJson);
        if (result.success) {
            this.state.allEntries = result.data;
            this.state.filteredEntries = [...this.state.allEntries];
            this.ui.renderEntries(this.state.filteredEntries, this.state.selectedPath);
        } else {
            console.error("Log App: Failed to load entries from Python", result.error);
        }
    }
};