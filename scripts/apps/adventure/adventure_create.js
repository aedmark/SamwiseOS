// scripts/apps/adventure/adventure_create.js

/**
 * Adventure Creator - A thin client for the Python-based interactive tool
 * @namespace Adventure_create
 */
window.Adventure_create = {
    state: {
        isActive: false,
        commandContext: null,
    },
    dependencies: {},

    enter(filename, initialData, commandContext) {
        if (this.state.isActive) return;

        this.dependencies = commandContext.dependencies;
        this.state = {
            isActive: true,
            commandContext: commandContext,
        };

        // Initialize the creator on the Python side
        const resultJson = OopisOS_Kernel.adventureCreatorInitialize(filename, JSON.stringify(initialData));
        const result = JSON.parse(resultJson);

        this.dependencies.OutputManager.appendToOutput(result.message, {
            typeClass: result.success ? "text-success" : "text-error"
        });

        if (result.success) {
            this._requestNextCommand();
        }
    },

    _requestNextCommand() {
        if (!this.state.isActive) return;

        const promptResultJson = OopisOS_Kernel.adventureCreatorGetPrompt();
        const promptResult = JSON.parse(promptResultJson);
        const prompt = promptResult.prompt || "(creator)> ";

        this.dependencies.ModalManager.request({
            context: "terminal",
            type: "input",
            messageLines: [prompt],
            onConfirm: async (input) => {
                const resultJson = OopisOS_Kernel.adventureCreatorProcessCommand(input);
                const result = JSON.parse(resultJson);

                if (result.output) {
                    await this.dependencies.OutputManager.appendToOutput(result.output, {
                        typeClass: result.success ? 'text-info' : 'text-error'
                    });
                }

                if (result.shouldExit) {
                    this.state.isActive = false;
                }

                if (this.state.isActive) {
                    this._requestNextCommand();
                }
            },
            onCancel: () => {
                if (this.state.isActive) this._requestNextCommand();
            },
            options: this.state.commandContext.options,
        });
    },

    isActive: () => this.state.isActive,
};