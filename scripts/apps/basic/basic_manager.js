window.BasicManager = class BasicManager extends App {

    constructor() {
        super();
        this.dependencies = {};
        this.programBuffer = new Map();
        this.onInputPromiseResolver = null;
        this.loadOptions = {};
        this.callbacks = {};
        this.ui = null;
    }

    enter(appLayer, options = {}) {
        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();

        this.isActive = true;
        this.loadOptions = options;

        this.ui = new this.dependencies.BasicUI(this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();

        appLayer.appendChild(this.container);

        this._init();
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;

        if (this.ui) {
            this.ui.reset();
        }
        AppLayerManager.hide(this);

        this.isActive = false;
        this.programBuffer.clear();
        this.onInputPromiseResolver = null;
        this.loadOptions = {};
        this.ui = null;
    }

    _init() {
        const { Config } = this.dependencies;
        this.ui.writeln(Config.MESSAGES.BASIC_WELCOME_1);
        this.ui.writeln(Config.MESSAGES.BASIC_WELCOME_2);
        this.ui.writeln("");

        if (this.loadOptions.content) {
            this._loadContentIntoBuffer(this.loadOptions.content);
            this.ui.writeln(`Loaded "${this.loadOptions.path}".`);
        }

        this.ui.writeln("READY.");
        setTimeout(() => this.ui.focusInput(), 0);
    }

    _createCallbacks() {
        return {
            onInput: this._handleIdeInput.bind(this),
            onExit: this.exit.bind(this),
        };
    }

    async _getKernelContext() {
        const { UserManager } = this.dependencies;
        const user = await UserManager.getCurrentUser();
        const primaryGroup = await UserManager.getPrimaryGroupForUser(user.name);
        return { name: user.name, group: primaryGroup };
    }

    _loadContentIntoBuffer(content) {
        this.programBuffer.clear();
        const lines = content.split("\n");
        for (const line of lines) {
            if (line.trim() === "") continue;
            const match = line.match(/^(\d+)\s*(.*)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const lineContent = match[2].trim();
                if (lineContent) {
                    this.programBuffer.set(lineNumber, lineContent);
                }
            }
        }
    }

    async _handleIdeInput(command) {
        command = command.trim();
        this.ui.writeln(`> ${command}`);

        if (this.onInputPromiseResolver) {
            this.onInputPromiseResolver(command);
            this.onInputPromiseResolver = null;
            return;
        }

        if (command === "") {
            this.ui.writeln("READY.");
            return;
        }

        const lineMatch = command.match(/^(\d+)(.*)/);
        if (lineMatch) {
            const lineNumber = parseInt(lineMatch[1], 10);
            const lineContent = lineMatch[2].trim();
            if (lineContent === "") {
                this.programBuffer.delete(lineNumber);
            } else {
                this.programBuffer.set(lineNumber, lineContent);
            }
        } else {
            const firstSpaceIndex = command.indexOf(" ");
            let cmd, argsStr;
            if (firstSpaceIndex === -1) {
                cmd = command.toUpperCase();
                argsStr = "";
            } else {
                cmd = command.substring(0, firstSpaceIndex).toUpperCase();
                argsStr = command.substring(firstSpaceIndex + 1).trim();
            }
            await this._executeIdeCommand(cmd, argsStr);
        }
        if (this.isActive) {
            this.ui.writeln("READY.");
        }
    }

    async _executeIdeCommand(cmd, argsStr) {
        switch (cmd) {
            case "RUN":
                await this._runProgram();
                break;
            case "LIST":
                this._listProgram();
                break;
            case "NEW":
                this.programBuffer.clear();
                this.loadOptions = {};
                this.ui.writeln("OK");
                break;
            case "SAVE":
                await this._saveProgram(argsStr);
                break;
            case "LOAD":
                await this._loadProgram(argsStr);
                break;
            case "EXIT":
                this.exit();
                break;
            default:
                this.ui.writeln("?SYNTAX ERROR");
                break;
        }
    }

    _getProgramText() {
        const sortedLines = Array.from(this.programBuffer.keys()).sort(
            (a, b) => a - b
        );
        return sortedLines
            .map((lineNum) => `${lineNum} ${this.programBuffer.get(lineNum)}`)
            .join("\n");
    }

    _listProgram() {
        const sortedLines = Array.from(this.programBuffer.keys()).sort(
            (a, b) => a - b
        );
        sortedLines.forEach((lineNum) => {
            this.ui.writeln(`${lineNum} ${this.programBuffer.get(lineNum)}`);
        });
        this.ui.writeln("OK");
    }

    async _runProgram() {
        const programText = this._getProgramText();
        if (programText.length === 0) {
            this.ui.writeln("OK");
            return;
        }

        const result = JSON.parse(await OopisOS_Kernel.syscall("basic", "run_program", [
            programText,
            (text, withNewline = true) => {
                withNewline ? this.ui.writeln(text) : this.ui.write(text);
            },
            async () => new Promise((resolve) => {
                this.onInputPromiseResolver = resolve;
            })
        ]));

        if (!result.success) {
            this.ui.writeln(`\n?RUNTIME ERROR: ${result.error}`);
        }

        this.ui.writeln("");
    }

    async _saveProgram(filePathArg) {
        const { FileSystemManager } = this.dependencies;
        let savePath = filePathArg
            ? filePathArg.replace(/["']/g, "")
            : this.loadOptions.path;
        if (!savePath) {
            this.ui.writeln("?NO FILENAME SPECIFIED");
            return;
        }
        if (!savePath.endsWith(".bas")) savePath += ".bas";

        const content = this._getProgramText();
        const absPath = FileSystemManager.getAbsolutePath(savePath);
        const context = await this._getKernelContext();
        const saveResult = await FileSystemManager.createOrUpdateFile(
            absPath,
            content,
            { currentUser: context.name, primaryGroup: context.group }
        );

        if (saveResult.success && (await FileSystemManager.save())) {
            this.loadOptions.path = savePath;
            this.ui.writeln("OK");
        } else {
            this.ui.writeln(
                `?ERROR SAVING FILE: ${saveResult.error || "Filesystem error"}`
            );
        }
    }

    async _loadProgram(filePathArg) {
        const { FileSystemManager } = this.dependencies;
        if (!filePathArg) {
            this.ui.writeln("?FILENAME REQUIRED");
            return;
        }
        const path = filePathArg.replace(/["']/g, "");
        const context = await this._getKernelContext();
        const pathValidation = await FileSystemManager.validatePath(path, {
            expectedType: "file",
            permissions: ["read"],
        }, context);

        if (!pathValidation.success) {
            this.ui.writeln(`?ERROR: ${pathValidation.error}`);
            return;
        }
        this._loadContentIntoBuffer(pathValidation.data.node.content);
        this.loadOptions = { path: path, content: pathValidation.data.node.content };
        this.ui.writeln("OK");
    }
}