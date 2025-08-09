// gem/scripts/apps/explorer/explorer_manager.js

window.ExplorerManager = class ExplorerManager extends App {
    constructor() {
        super();
        // State is now managed by Python!
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
        this.currentPath = "/"; // Only to keep track of the current view
    }

    async enter(appLayer, options = {}) {
        this.isActive = true;
        this.ui = new ExplorerUI(this._createCallbacks(), this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        await this._updateView(options.startPath || "/");
    }

    _createCallbacks() {
        // Callbacks now trigger calls to the Python kernel
        return {
            onExit: this.exit.bind(this),
            onTreeItemSelect: async (path) => {
                await OopisOS_Kernel.explorerToggleTree(path);
                await this._updateView(path);
            },
            onMainItemActivate: async (path, type) => {
                if (type === "directory") {
                    await OopisOS_Kernel.explorerToggleTree(path); // Ensure it's expanded
                    await this._updateView(path);
                } else {
                    // Launch editor (this logic remains in JS for now)
                    this.exit();
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.dependencies.CommandExecutor.processSingleCommand(`edit "${path}"`, { isInteractive: true });
                }
            },
        };
    }

    async _updateView(path) {
        if (!this.ui) return;
        const { UserManager } = this.dependencies;
        this.currentPath = path;

        const context = {
            user_context: { name: UserManager.getCurrentUser().name },
            current_path: this.currentPath
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