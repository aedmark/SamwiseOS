// gem/scripts/apps/explorer/explorer_manager.js

window.ExplorerManager = class ExplorerManager extends App {
    constructor() {
        super();
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
        this.currentPath = "/";
    }

    async enter(appLayer, options = {}) {
        this.dependencies = options.dependencies;

        this.isActive = true;
        this.ui = new ExplorerUI(this._createCallbacks(), this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        await this._updateView(options.startPath || "/");
    }

    /**
     * [FIX] Re-implement the exit method to properly clean up the application.
     */
    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;
        if (this.ui) {
            this.ui.reset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.ui = null;
    }

    /**
     * [FIX] Re-implement the key handler to allow exiting with the Escape key.
     */
    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.exit();
        }
    }


    _getContext() {
        const { UserManager } = this.dependencies;
        return JSON.stringify({
            user_context: { name: UserManager.getCurrentUser().name },
            current_path: this.currentPath,
        });
    }

    _createCallbacks() {
        const { ModalManager } = this.dependencies;
        return {
            onExit: this.exit.bind(this),
            onTreeItemSelect: async (path) => {
                await OopisOS_Kernel.explorerToggleTree(path);
                await this._updateView(path);
            },
            onMainItemActivate: async (path, type) => {
                if (type === "directory") {
                    await OopisOS_Kernel.explorerToggleTree(path);
                    await this._updateView(path);
                } else {
                    this.exit();
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.dependencies.CommandExecutor.processSingleCommand(`edit "${path}"`, { isInteractive: true });
                }
            },

            onCreateFile: async (path) => {
                const name = await new Promise(r => ModalManager.request({ context: "graphical", type: "input", messageLines: ["Enter New File Name:"], onConfirm: val => r(val), onCancel: () => r(null)}));
                if (name) {
                    const result = JSON.parse(OopisOS_Kernel.explorerCreateNode(path, name, 'file', this._getContext()));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onCreateDirectory: async (path) => {
                const name = await new Promise(r => ModalManager.request({ context: "graphical", type: "input", messageLines: ["Enter New Directory Name:"], onConfirm: val => r(val), onCancel: () => r(null)}));
                if (name) {
                    const result = JSON.parse(OopisOS_Kernel.explorerCreateNode(path, name, 'directory', this._getContext()));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onRename: async (path, oldName) => {
                const newName = await new Promise(r => ModalManager.request({ context: "graphical", type: "input", messageLines: [`Rename "${oldName}":`], placeholder: oldName, onConfirm: val => r(val), onCancel: () => r(null)}));
                if (newName && newName !== oldName) {
                    const result = JSON.parse(OopisOS_Kernel.explorerRenameNode(path, newName, this._getContext()));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onDelete: async (path, name) => {
                const confirmed = await new Promise(r => ModalManager.request({ context: "graphical", messageLines: [`Are you sure you want to delete "${name}"?`], onConfirm: () => r(true), onCancel: () => r(false)}));
                if (confirmed) {
                    const result = JSON.parse(OopisOS_Kernel.explorerDeleteNode(path, this._getContext()));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            }
        };
    }

    async _updateView(path) {
        if (!this.ui) return;
        const { UserManager } = this.dependencies;
        this.currentPath = path;

        const context = {
            user_context: { name: UserManager.getCurrentUser().name },
            current_path: this.currentPath,
        };
        const resultJson = OopisOS_Kernel.explorerGetView(path, JSON.stringify(context));
        const result = JSON.parse(resultJson);

        if (result.success) {
            const { treeData, mainPaneItems, expandedPaths } = result.data;
            this.ui.renderTree(treeData, this.currentPath, new Set(expandedPaths));
            this.ui.renderMainPane(mainPaneItems, this.currentPath);
            this.ui.updateStatusBar(this.currentPath, mainPaneItems.length);
        } else {
            console.error("Failed to get explorer view from Python:", result.error);
        }
    }
};