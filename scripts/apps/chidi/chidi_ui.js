// scripts/apps/chidi/chidi_ui.js

window.ChidiUI = class ChidiUI {

    constructor(initialState, callbacks, dependencies) {
        this.elements = {};
        this.callbacks = callbacks;
        this.dependencies = dependencies;

        this._buildAndShow(initialState);
    }

    getContainer() {
        return this.elements.container;
    }

    _buildAndShow(initialState) {
        const { Utils, UIComponents } = this.dependencies;

        const appWindow = UIComponents.createAppWindow('SamwiseOS Chidi', this.callbacks.onClose);
        this.elements.container = appWindow.container;
        this.elements.main = appWindow.main;
        this.elements.footer = appWindow.footer;

        // Get references to the standard header elements
        this.elements.mainTitle = appWindow.header.querySelector('.app-header__title');
        const exitBtn = appWindow.header.querySelector('.app-header__exit-btn');

        // Clear the header to rebuild it in the correct order
        appWindow.header.innerHTML = '';

        const headerControlsLeft = Utils.createElement(
            "div",
            { id: "chidi-nav-controls", className: "chidi-control-group" },
            [
                (this.elements.prevBtn = UIComponents.createButton({
                    id: "chidi-prevBtn",
                    classes: ["chidi-btn"],
                    text: "< Prev",
                })),
                (this.elements.nextBtn = UIComponents.createButton({
                    id: "chidi-nextBtn",
                    classes: ["chidi-btn"],
                    text: "Next >",
                }))
            ]
        );

        const headerControlsRight = Utils.createElement(
            "div",
            { className: "chidi-control-group" },
            [
                (this.elements.summarizeBtn = UIComponents.createButton({
                    id: "chidi-summarizeBtn",
                    classes: ["chidi-btn"],
                    text: "Summarize",
                })),
                (this.elements.studyBtn = UIComponents.createButton({
                    id: "chidi-suggestQuestionsBtn",
                    classes: ["chidi-btn"],
                    text: "Study",
                })),
                (this.elements.askBtn = UIComponents.createButton({
                    id: "chidi-askAllFilesBtn",
                    classes: ["chidi-btn"],
                    text: "Ask",
                }))
            ]
        );

        // Re-append all elements to the header in a logical structure
        appWindow.header.append(headerControlsLeft, this.elements.mainTitle, headerControlsRight, exitBtn);


        this.elements.markdownDisplay = Utils.createElement("main", {
            id: "chidi-markdownDisplay",
            className: "chidi-markdown-content",
        });
        this.elements.main.appendChild(this.elements.markdownDisplay);

        this.elements.fileCountDisplay = Utils.createElement("div", {
            id: "chidi-fileCountDisplay",
            className: "chidi-status-item",
        });
        this.elements.messageBox = Utils.createElement("div", {
            id: "chidi-messageBox",
            className: "chidi-status-message",
        });
        const footerControls = Utils.createElement(
            "div",
            { className: "chidi-control-group" },
            [
                (this.elements.loader = Utils.createElement("div", {
                    id: "chidi-loader",
                    className: "chidi-loader chidi-hidden",
                })),
                (this.elements.saveSessionBtn = UIComponents.createButton({
                    id: "chidi-saveSessionBtn",
                    classes: ["chidi-btn"],
                    text: "Save",
                })),
                (this.elements.exportBtn = UIComponents.createButton({
                    id: "chidi-exportBtn",
                    classes: ["chidi-btn"],
                    text: "Export",
                })),
            ]
        );

        this.elements.footer.append(this.elements.fileCountDisplay, this.elements.messageBox, footerControls);


        this._setupEventListeners();
        this.update(initialState);
    }

    hideAndReset() {
        this.elements = {};
        this.callbacks = {};
        this.dependencies = {};
    }

    update(state) {
        if (!this.elements.container) return;
        const { Utils } = this.dependencies;

        const hasFiles = state.loadedFiles.length > 0;
        const currentFile = hasFiles ? state.loadedFiles[state.currentIndex] : null;

        this.elements.fileCountDisplay.textContent = `File ${state.currentIndex + 1} of ${state.loadedFiles.length}`;
        this.elements.prevBtn.disabled = !hasFiles || state.currentIndex === 0;
        this.elements.nextBtn.disabled =
            !hasFiles || state.currentIndex >= state.loadedFiles.length - 1;

        this.elements.exportBtn.disabled = !hasFiles;
        this.elements.saveSessionBtn.disabled = !hasFiles;
        this.elements.summarizeBtn.disabled = !hasFiles;
        this.elements.studyBtn.disabled = !hasFiles;
        this.elements.askBtn.disabled = !hasFiles;

        if (currentFile) {
            this.elements.mainTitle.textContent = currentFile.name.replace(
                /\.(md|txt|js|sh)$/i,
                ""
            );
            this.elements.markdownDisplay.className = "chidi-markdown-content";
            if (
                currentFile.isCode ||
                Utils.getFileExtension(currentFile.name) === "txt"
            ) {
                this.elements.markdownDisplay.innerHTML = `<pre>${currentFile.content || ""}</pre>`;
            } else {
                this.elements.markdownDisplay.innerHTML = DOMPurify.sanitize(
                    marked.parse(currentFile.content)
                );
            }
        } else {
            this.elements.mainTitle.textContent = "SamwiseOS Chidi";
            this.elements.markdownDisplay.innerHTML = `<p>No files loaded.</p>`;
        }
    }

    _setupEventListeners() {
        this.elements.exportBtn.addEventListener("click", this.callbacks.onExport);
        this.elements.prevBtn.addEventListener("click", this.callbacks.onPrevFile);
        this.elements.nextBtn.addEventListener("click", this.callbacks.onNextFile);
        this.elements.askBtn.addEventListener("click", this.callbacks.onAsk);
        this.elements.summarizeBtn.addEventListener("click", this.callbacks.onSummarize);
        this.elements.studyBtn.addEventListener("click", this.callbacks.onStudy);
        this.elements.saveSessionBtn.addEventListener("click", this.callbacks.onSaveSession);

        document.addEventListener(
            "keydown",
            (e) => {
                if (!this.elements.container?.isConnected) return;
                if (e.key === "Escape") {
                    this.callbacks.onClose();
                }
            },
            true
        );
    }

    showMessage(msg) {
        if (this.elements.messageBox) this.elements.messageBox.textContent = `֎ ${msg}`;
    }

    appendAiOutput(title, content) {
        const outputBlock = this.dependencies.Utils.createElement("div", {
            className: "chidi-ai-output",
        });
        outputBlock.innerHTML = DOMPurify.sanitize(
            marked.parse(`### ${title}\n\n${content}`)
        );
        this.elements.markdownDisplay.appendChild(outputBlock);
        outputBlock.scrollIntoView({ behavior: "smooth", block: "start" });
        this.showMessage(`AI Response received for "${title}".`);
    }

    toggleLoader(show) {
        if (this.elements.loader)
            this.elements.loader.classList.toggle("chidi-hidden", !show);
    }

    packageSessionAsHTML(state) {
        const { Utils } = this.dependencies;
        const currentFile = state.loadedFiles[state.currentIndex];
        const content = this.elements.markdownDisplay.innerHTML;
        const title = `Chidi Session: ${currentFile?.name || "Untitled"}`;
        const styles =
            "body{background-color:#0d0d0d;color:#e4e4e7;font-family:'VT323',monospace;line-height:1.6;padding:2rem}h1,h2,h3{border-bottom:1px solid #444;padding-bottom:.3rem;color:#60a5fa}a{color:#34d399}pre{white-space:pre-wrap;background-color:#000;padding:1rem;border-radius:4px}.chidi-ai-output{border-top:2px dashed #60a5fa;margin-top:2rem;padding-top:1rem}";
        return `<!DOCTYPE html><html lang="en"><head><title>${title}</title><style>${styles}</style></head><body><h1>${title}</h1>${content}</body></html>`;
    }
}