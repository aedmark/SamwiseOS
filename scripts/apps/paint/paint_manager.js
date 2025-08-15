window.PaintManager = class PaintManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
    }

    enter(appLayer, options = {}) {
        if (this.isActive) return;
        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();
        this.isWindowed = options.isWindowed || false;

        const { filePath, fileContent } = options;
        const resultJson = OopisOS_Kernel.syscall("paint", "get_initial_state", [filePath, fileContent]);
        const result = JSON.parse(resultJson);

        if (!result.success) {
            console.error("Paint App Error:", result.error);
            this.dependencies.ModalManager.request({
                context: "graphical", type: "alert",
                messageLines: [`Failed to initialize Paint: ${result.error}`]
            });
            return;
        }

        this.state = {
            ...result.data, // Core state from Python
            currentTool: "pencil",
            currentCharacter: "#",
            currentColor: "#FFFFFF",
            brushSize: 1,
            gridVisible: false,
            isDrawing: false,
            startCoords: null,
            lastCoords: null,
            zoomLevel: 100,
            ZOOM_MIN: 50,
            ZOOM_MAX: 200,
            ZOOM_STEP: 10,
            selection: null,
            clipboard: null,
        };

        this.isActive = true;
        this.ui = new PaintUI(this.state, this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);
        this.container.focus();
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;
        if (this.ui) this.ui.hideAndReset();
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
    }

    _updateStateFromPython(pyResult) {
        if (pyResult && pyResult.success && pyResult.data) {
            this.state = { ...this.state, ...pyResult.data };
            this.ui.renderInitialCanvas(this.state.canvasData, this.state.canvasDimensions);
            this.ui.updateToolbar(this.state);
        } else if (pyResult && !pyResult.success) {
            console.error("Paint Python Kernel Error:", pyResult.error);
        }
    }

    _createCallbacks() {
        return {
            onExitRequest: this.exit.bind(this),
            onToolSelect: (tool) => {
                this.state.currentTool = tool;
                this.ui.updateToolbar(this.state);
                this.ui.updateStatusBar(this.state);
            },
            onColorSelect: (color) => { this.state.currentColor = color; },
            onBrushSizeChange: (size) => { this.state.brushSize = size; },
            onCharChange: (char) => { this.state.currentCharacter = char || " "; },
            onUndo: () => this._updateStateFromPython(JSON.parse(OopisOS_Kernel.syscall("paint", "undo"))),
            onRedo: () => this._updateStateFromPython(JSON.parse(OopisOS_Kernel.syscall("paint", "redo"))),
            onToggleGrid: () => {
                this.state.gridVisible = !this.state.gridVisible;
                this.ui.toggleGrid(this.state.gridVisible);
            },
            isGridVisible: () => this.state.gridVisible,
            onZoomIn: () => {
                this.state.zoomLevel = Math.min(this.state.ZOOM_MAX, this.state.zoomLevel + this.state.ZOOM_STEP);
                this.ui.updateZoom(this.state.zoomLevel);
                this.ui.updateStatusBar(this.state);
            },
            onZoomOut: () => {
                this.state.zoomLevel = Math.max(this.state.ZOOM_MIN, this.state.zoomLevel - this.state.ZOOM_STEP);
                this.ui.updateZoom(this.state.zoomLevel);
                this.ui.updateStatusBar(this.state);
            },
            onGetState: () => this.state,
            onCanvasMouseDown: (coords) => {
                this.state.isDrawing = true;
                this.state.startCoords = coords;
                this.state.lastCoords = coords;

                // For tools that draw continuously, we call the backend on mouse move.
                // For single-click tools like 'fill', we can call it here.
                if (this.state.currentTool === 'fill') {
                    const result = JSON.parse(OopisOS_Kernel.syscall("paint", "draw_shape", [
                        this.state.currentTool,
                        coords,
                        coords, // Start and end are the same for fill
                        this.state.currentCharacter,
                        this.state.currentColor,
                        this.state.brushSize
                    ]));
                    this._updateStateFromPython(result);
                    this._pushUndoState();
                    this.state.isDrawing = false;
                }
            },
            onCanvasMouseMove: (coords) => {
                this.ui.updateStatusBar(this.state, coords);
                if (!this.state.isDrawing) return;

                const tool = this.state.currentTool;

                // For continuous drawing tools like pencil and eraser
                if (tool === 'pencil' || tool === 'eraser') {
                    const result = JSON.parse(OopisOS_Kernel.syscall("paint", "draw_shape", [
                        tool,
                        this.state.lastCoords,
                        coords,
                        this.state.currentCharacter,
                        this.state.currentColor,
                        this.state.brushSize
                    ]));
                    this._updateStateFromPython(result);
                } else if (['line', 'rect', 'circle'].includes(tool)) {
                    // Previewing shapes is a UI-only concern, so we can keep that logic here for now.
                    // This avoids spamming the backend with preview updates.
                    this._previewShape(this.state.startCoords, coords);
                }

                this.state.lastCoords = coords;
            },

            onCanvasMouseUp: (coords) => {
                if (!this.state.isDrawing) return;
                this.state.isDrawing = false;

                const tool = this.state.currentTool;
                const endCoords = coords || this.state.lastCoords;

                // Only call the backend for tools that draw on mouse up
                if (['line', 'rect', 'circle', 'pencil', 'eraser'].includes(tool)) {
                    const result = JSON.parse(OopisOS_Kernel.syscall("paint", "draw_shape", [
                        tool,
                        this.state.startCoords,
                        endCoords,
                        this.state.currentCharacter,
                        this.state.currentColor,
                        this.state.brushSize
                    ]));
                    this._updateStateFromPython(result);
                    this._pushUndoState();
                }

                this.ui.clearPreview();
            },
        };
    }

    _pushUndoState() {
        const result = JSON.parse(OopisOS_Kernel.syscall("paint", "push_undo_state", [JSON.stringify(this.state.canvasData)]));
        this._updateStateFromPython(result);
    }
};