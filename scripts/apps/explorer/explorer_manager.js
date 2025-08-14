// /scripts/apps/explorer/explorer_manager.js

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

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;
        if (this.ui) this.ui.reset();
        AppLayerManager.hide(this);
        this.isActive = false;
        this.ui = null;
    }

    handleKeyDown(event) {
        if (event.key === "Escape") this.exit();
    }

    async _getContext() {
        const { UserManager } = this.dependencies;
        const user = await UserManager.getCurrentUser();
        return { name: user.name };
    }

    _createCallbacks() {
        const { ModalManager } = this.dependencies;
        return {
            onExit: this.exit.bind(this),
            onTreeItemSelect: async (path) => {
                await OopisOS_Kernel.syscall("explorer", "toggle_tree_expansion", [path]);
                await this._updateView(path);
            },
            onMainItemActivate: async (path, type) => {
                if (type === "directory") {
                    await OopisOS_Kernel.syscall("explorer", "toggle_tree_expansion", [path]);
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
                    const result = JSON.parse(await OopisOS_Kernel.syscall("explorer", "create_node", [path, name, 'file', await this._getContext()]));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onCreateDirectory: async (path) => {
                const name = await new Promise(r => ModalManager.request({ context: "graphical", type: "input", messageLines: ["Enter New Directory Name:"], onConfirm: val => r(val), onCancel: () => r(null)}));
                if (name) {
                    const result = JSON.parse(await OopisOS_Kernel.syscall("explorer", "create_node", [path, name, 'directory', await this._getContext()]));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onRename: async (path, oldName) => {
                const newName = await new Promise(r => ModalManager.request({ context: "graphical", type: "input", messageLines: [`Rename "${oldName}":`], placeholder: oldName, onConfirm: val => r(val), onCancel: () => r(null)}));
                if (newName && newName !== oldName) {
                    const result = JSON.parse(await OopisOS_Kernel.syscall("explorer", "rename_node", [path, newName, await this._getContext()]));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            },
            onDelete: async (path, name) => {
                const confirmed = await new Promise(r => ModalManager.request({ context: "graphical", messageLines: [`Are you sure you want to delete "${name}"?`], onConfirm: () => r(true), onCancel: () => r(false)}));
                if (confirmed) {
                    const result = JSON.parse(await OopisOS_Kernel.syscall("explorer", "delete_node", [path, await this._getContext()]));
                    if (!result.success) alert(`Error: ${result.error}`);
                    await this._updateView(this.currentPath);
                }
            }
        };
    }

    async _updateView(path) {
        if (!this.ui) return;
        this.currentPath = path;
        const context = await this._getContext();

        const result = JSON.parse(await OopisOS_Kernel.syscall("explorer", "get_view_data", [path, context]));

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