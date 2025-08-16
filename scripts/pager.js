// /scripts/pager.js

class PagerUI {
    constructor(dependencies) {
        this.elements = {};
        this.dependencies = dependencies;
    }

    buildLayout() {
        const { Utils } = this.dependencies;
        this.elements.content = Utils.createElement("div", {
            id: "pager-content",
            className: "p-2 whitespace-pre-wrap",
        });
        this.elements.statusBar = Utils.createElement("div", {
            id: "pager-status",
            className: "bg-gray-700 text-white p-1 text-center font-bold",
        });
        this.elements.container = Utils.createElement(
            "div",
            {
                id: "pager-container",
                className: "flex flex-col h-full w-full bg-black text-white font-mono",
            },
            [this.elements.content, this.elements.statusBar]
        );
        return this.elements.container;
    }

    render(lines, topVisibleLine, mode, terminalRows) {
        if (!this.elements.content || !this.elements.statusBar) return;

        const visibleLines = lines.slice(
            topVisibleLine,
            topVisibleLine + terminalRows
        );
        this.elements.content.innerHTML = visibleLines.join("<br>");

        const percent =
            lines.length > 0
                ? Math.min(
                    100,
                    Math.round(((topVisibleLine + terminalRows) / lines.length) * 100)
                )
                : 100;
        this.elements.statusBar.textContent = `-- ${mode.toUpperCase()} -- (${percent}%) (q to quit)`;
    }

    getTerminalRows() {
        const { Utils } = this.dependencies;
        if (!this.elements.content) return 24;
        const screenHeight = this.elements.content.clientHeight;
        const computedStyle = window.getComputedStyle(this.elements.content);
        const fontStyle = computedStyle.font;
        const { height: lineHeight } = Utils.getCharacterDimensions(fontStyle);
        if (lineHeight === 0) {
            return 24;
        }

        return Math.max(1, Math.floor(screenHeight / lineHeight));
    }

    reset() {
        this.elements = {};
    }
}

window.PagerManager = class PagerManager extends (window.App || class {}) {
    constructor() {
        super();

        this.dependencies = {};
        this.ui = null;
        this.lines = [];
        this.topVisibleLine = 0;
        this.terminalRows = 24;
        this.mode = "more";
    }

    handleKeyDown(e) {
        if (!this.isActive) return;

        e.preventDefault();
        let scrolled = false;

        switch (e.key) {
            case "q":
            case "Escape": // Also allow Escape to quit, consistent with other apps
                this.exit();
                break;
            case " ":
            case "f":
            case "PageDown": // Add PageDown for more intuitive scrolling
                this.topVisibleLine = Math.min(
                    this.topVisibleLine + this.terminalRows,
                    Math.max(0, this.lines.length - this.terminalRows)
                );
                scrolled = true;
                break;
            case "ArrowDown":
            case "j": // Vim-style navigation
                if (this.mode === "less") {
                    this.topVisibleLine = Math.min(
                        this.topVisibleLine + 1,
                        Math.max(0, this.lines.length - this.terminalRows)
                    );
                    scrolled = true;
                }
                break;
            case "b":
            case "PageUp": // Add PageUp for more intuitive scrolling
            case "ArrowUp":
            case "k": // Vim-style navigation
                if (this.mode === "less") {
                    // In 'less', ArrowUp should scroll by one line, not a full page.
                    if (e.key === "ArrowUp" || e.key === "k") {
                        this.topVisibleLine = Math.max(0, this.topVisibleLine - 1);
                    } else {
                        this.topVisibleLine = Math.max(0, this.topVisibleLine - this.terminalRows);
                    }
                    scrolled = true;
                }
                break;
        }

        if (scrolled) {
            this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
        }
    }

    enter(appLayer, options) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.ui = new PagerUI(this.dependencies);
        this.isActive = true;

        this.lines = options.content.split("\n");
        this.topVisibleLine = 0;
        this.mode = options.mode || "more";

        this.container = this.ui.buildLayout();
        appLayer.appendChild(this.container);

        // Use a timeout to ensure the element is in the DOM and has dimensions.
        setTimeout(() => {
            if (!this.isActive) return; // Check if exited before timeout
            this.terminalRows = this.ui.getTerminalRows();
            this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
        }, 0);
    }

    exit() {
        if (!this.isActive) return;
        this.isActive = false;

        // The AppLayerManager is responsible for removing the container.
        // We just need to tell it that we are done.
        this.dependencies.AppLayerManager.hide(this);

        if (this.ui) {
            this.ui.reset();
            this.ui = null;
        }
        this.lines = [];
        this.topVisibleLine = 0;
    }
}