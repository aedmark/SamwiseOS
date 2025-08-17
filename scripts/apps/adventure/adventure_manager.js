// scripts/apps/adventure/adventure_manager.js

window.AdventureManager = class AdventureManager extends App {
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
        const { TextAdventureModal } = this.dependencies;
        this.callbacks = { processCommand: this.processCommand.bind(this), onExitRequest: this.exit.bind(this), };
        this.isActive = true;

        const initialStateResult = JSON.parse(
            await OopisOS_Kernel.syscall("adventure", "initialize_state", [
                JSON.stringify(options.adventureData),
                options.scriptingContext ? JSON.stringify(options.scriptingContext) : null
            ])
        );

        this.ui = new TextAdventureModal(this.callbacks, this.dependencies, options.scriptingContext);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        if (initialStateResult.success) this._applyUiUpdates(initialStateResult.updates);
        else this.ui.appendOutput("I couldn't start the adventure.", "error");

        if (options.scriptingContext?.isScripting) await this._runScript(options.scriptingContext);
        else setTimeout(() => this.container.focus(), 0);
    }

    _applyUiUpdates(updates) {
        updates.forEach(update => {
            switch (update.type) {
                case "output":
                    this.ui.appendOutput(update.text, update.styleClass);
                    break;
                case "status":
                    this.ui.updateStatusLine(update.roomName, update.score, update.moves);
                    break;
            }
        });
    }

    async _runScript(scriptingContext) {
        while (
            scriptingContext.currentLineIndex < scriptingContext.lines.length - 1 &&
            this.isActive
            ) {
            let nextCommand = await this.ui.requestInput("");
            if (nextCommand === null) break;
            await this.processCommand(nextCommand);
        }
        if (this.isActive) {
            this.exit();
        }
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;
        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
        this.ui = null;
    }

    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.exit();
        }
    }


    async processCommand(command) {
        const result = JSON.parse(await OopisOS_Kernel.syscall("adventure", "process_command", [command]));
        if (result.success) {
            this._applyUiUpdates(result.updates);
            if (result.gameOver) {
                this.ui.elements.input.disabled = true;
                setTimeout(() => this.exit(), 1200);
            }
        } else {
            this.ui.appendOutput(result.error, "error");
        }
    }
};