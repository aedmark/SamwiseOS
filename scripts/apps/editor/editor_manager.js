// gem/scripts/apps/editor/editor_manager.js

window.EditorManager = class EditorManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this._debouncedPushUndo = null;
        this.callbacks = {};
        this.ui = null;
    }

    async enter(appLayer, options = {}) {
        const { filePath, fileContent, onSaveCallback, dependencies } = options;
        this.dependencies = dependencies;
        this.callbacks = this._createCallbacks();

        this._debouncedPushUndo = this.dependencies.Utils.debounce(async (content) => { // Make debounced function async
            if (!this.isActive) return;
            const result = JSON.parse(await OopisOS_Kernel.syscall("editor", "push_undo_state", [content]));
            this._updateStateFromPython(result);
        }, 500);

        const normalizedContent = (fileContent || "").replace(/\r\n|\r/g, "\n");
        const loadResult = JSON.parse(await OopisOS_Kernel.syscall("editor", "load_file", [filePath, normalizedContent]));

        if (!loadResult.success) {
            const errorMessage = `Failed to initialize editor: ${loadResult.error}`;
            console.error(errorMessage);
            this.dependencies.ModalManager.request({ context: "graphical", type: "alert", messageLines: [errorMessage] });
            return;
        }

        this.state = {
            ...loadResult.data,
            currentFilePath: filePath,
            currentContent: normalizedContent,
            isDirty: false,
            fileMode: this._getFileMode(filePath),
            viewMode: "split",
            wordWrap: this.dependencies.StorageManager.loadItem(this.dependencies.Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor Word Wrap", false),
            onSaveCallback: onSaveCallback || null,
        };

        this.isActive = true;
        this.ui = new EditorUI(this.state, this.callbacks, this.dependencies);
        this.container = this.ui.elements.container;
        appLayer.appendChild(this.container);
        this.container.focus();
        this._updateContent(this.ui.elements.textarea);
        this._updateButtonStates();
    }

    _updateStateFromPython(pyResult) {
        if (pyResult.success && pyResult.data) {
            this.state.canUndo = pyResult.data.canUndo;
            this.state.canRedo = pyResult.data.canRedo;
            this._updateButtonStates();
            if (pyResult.data.content !== undefined) {
                this.ui.setContent(pyResult.data.content);
                this.state.currentContent = pyResult.data.content;
                this._updateContent(this.ui.elements.textarea);
                this._checkDirty();
            }
        } else if (!pyResult.success) {
            console.error("Editor Python Kernel Error:", pyResult.error);
        }
    }

    _createCallbacks() {
        return {
            onContentChange: (element) => {
                const newContent = element.textContent || "";
                this.state.currentContent = newContent;
                this._checkDirty();
                this._debouncedPushUndo(newContent);
                this._updateContent(element);
            },
            onSaveRequest: async () => {
                const { ModalManager, FileSystemManager, UserManager } = this.dependencies;
                let savePath = this.ui.elements.titleInput.value || this.state.currentFilePath;

                if (!savePath) {
                    savePath = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "graphical", type: "input", messageLines: ["Save New File"], placeholder: "/home/Guest/untitled.txt",
                            onConfirm: (value) => resolve(value), onCancel: () => resolve(null),
                        });
                    });
                    if (!savePath) { this.ui.updateStatusMessage("Save cancelled."); return; }
                    this.state.currentFilePath = savePath;
                    this.state.fileMode = this._getFileMode(savePath);
                    this.ui.updateWindowTitle(savePath);
                }

                const currentContent = this.ui.elements.textarea.textContent || "";
                const saveResult = await FileSystemManager.createOrUpdateFile(savePath, currentContent, {
                        currentUser: (await UserManager.getCurrentUser()).name,
                        primaryGroup: await UserManager.getPrimaryGroupForUser((await UserManager.getCurrentUser()).name),
                    }
                );

                if (saveResult.success) {
                    await FileSystemManager.save();
                    const pyResult = JSON.parse(await OopisOS_Kernel.syscall("editor", "update_on_save", [savePath, currentContent]));
                    this.state.originalContent = currentContent;
                    this._updateStateFromPython(pyResult);
                    this._checkDirty();
                    this.ui.updateStatusMessage(`File saved to ${savePath}`);
                    if (typeof this.state.onSaveCallback === "function") {
                        await this.state.onSaveCallback(savePath);
                    }
                } else {
                    this.ui.updateStatusMessage(`Error: ${saveResult.error.message || saveResult.error}`);
                }
            },
            onExitRequest: this.exit.bind(this),
            onTogglePreview: () => {
                const modes = ["split", "edit", "preview"];
                this.state.viewMode = modes[(modes.indexOf(this.state.viewMode) + 1) % modes.length];
                this.ui.setViewMode(this.state.viewMode, this.state.fileMode, this.ui.elements.textarea.textContent || "");
            },
            onUndo: async () => {
                const result = JSON.parse(await OopisOS_Kernel.syscall("editor", "undo"));
                this._updateStateFromPython(result);
            },
            onRedo: async () => {
                const result = JSON.parse(await OopisOS_Kernel.syscall("editor", "redo"));
                this._updateStateFromPython(result);
            },
            onWordWrapToggle: () => {
                const { StorageManager, Config } = this.dependencies;
                this.state.wordWrap = !this.state.wordWrap;
                StorageManager.saveItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, this.state.wordWrap);
                this.ui.setWordWrap(this.state.wordWrap);
            },
        };
    }
    _checkDirty() {
        const newContent = this.ui.elements.textarea.textContent || "";
        this.state.isDirty = newContent !== this.state.originalContent;
        this.ui.updateDirtyStatus(this.state.isDirty);
    }

    _updateButtonStates() {
        this.ui.elements.undoBtn.disabled = !this.state.canUndo;
        this.ui.elements.redoBtn.disabled = !this.state.canRedo;
    }
    _getFileMode(filePath) {
        const { Utils } = this.dependencies;
        if (!filePath) return "text";
        const extension = Utils.getFileExtension(filePath);
        const codeExtensions = ["js", "sh", "css", "json", "py"];
        if (extension === "md") return "markdown";
        if (extension === "html") return "html";
        if (codeExtensions.includes(extension)) return "code";
        return "text";
    }

    _jsHighlighter(text) {
        const escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return escapedText
            .replace(/(\/\*[\s\S]*?\*\/|\/\/.+|#.+)/g, "<em>$1</em>")
            .replace(/\b(new|if|else|do|while|def|class|return|function|var|const|let|async|await|import|from)(?=[^\w])/g, "<strong>$1</strong>")
            .replace(/(".*?"|'.*?'|`.*?`)/g, "<strong><em>$1</em></strong>");
    }

    _updateContent(element) {
        if (this.state.fileMode === 'code') {
            const selection = this._getSelection(element);
            element.innerHTML = this._jsHighlighter(element.textContent || "");
            this._setSelection(element, selection);
        }
        if (this.state.viewMode !== "edit") {
            this.ui.renderPreview(element.textContent || "", this.state.fileMode);
        }
    }

    async exit() {
        if (!this.isActive) return;
        if (this.state.isDirty) {
            await new Promise((resolve) => {
                this.dependencies.ModalManager.request({
                    context: "graphical",
                    type: "confirm",
                    messageLines: ["You have unsaved changes. Exit anyway?"],
                    onConfirm: () => { this._performExit(); resolve(); },
                    onCancel: () => resolve(),
                });
            });
        } else {
            this._performExit();
        }
    }

    _performExit() {
        this.ui.hideAndReset();
        this.dependencies.AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
    }

    _getSelection(element) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return { start: 0, end: 0 };
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(element);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        return { start: start, end: start + range.toString().length };
    }

    _setSelection(element, offset) {
        const range = document.createRange();
        const sel = window.getSelection();
        let charCount = 0;
        let foundNode = false;
        function findTextNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nextCharCount = charCount + node.length;
                if (!foundNode && offset.start >= charCount && offset.start <= nextCharCount) {
                    range.setStart(node, offset.start - charCount);
                    foundNode = true;
                }
                if (foundNode && offset.end >= charCount && offset.end <= nextCharCount) {
                    range.setEnd(node, offset.end - charCount);
                    return true;
                }
                charCount = nextCharCount;
            } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (findTextNode(node.childNodes[i])) return true;
                }
            }
            return false;
        }
        findTextNode(element);
        if (sel && foundNode) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
};