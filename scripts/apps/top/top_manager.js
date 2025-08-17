
window.TopManager = class TopManager extends App {

    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
        this.updateInterval = null;
    }

    enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();
        this.isActive = true;

        this.ui = new this.dependencies.TopUI(this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        this.updateInterval = setInterval(() => this._updateProcessList(), 1000);
        this._updateProcessList();
        this.container.focus();
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;

        clearInterval(this.updateInterval);
        this.updateInterval = null;

        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
        this.ui = null;
    }

    handleKeyDown(event) {
        if (event.key === "q" || event.key === "Escape") {
            this.exit();
        }
    }

    _createCallbacks() {
        return {
            onExit: this.exit.bind(this),
        };
    }

    async _updateProcessList() {
        if (!OopisOS_Kernel || !OopisOS_Kernel.isReady) return;

        const jobs = this.dependencies.CommandExecutor.getActiveJobs();
        const resultJson = await OopisOS_Kernel.syscall("top", "get_process_list", [jobs]);
        const result = JSON.parse(resultJson);

        if (this.ui && result.success) {
            this.ui.render(result.data);
        } else if (!result.success) {
            console.error("Top App Error:", result.error);
        }
    }
};