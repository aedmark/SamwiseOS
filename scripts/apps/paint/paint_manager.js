/**
 * Paint Manager - Manages UI interaction and delegates all state
 * management to the Python kernel's PaintManager.
 * @class PaintManager
 * @extends App
 */
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
        const resultJson = OopisOS_Kernel.paintGetInitialState(filePath, fileContent);
        const result = JSON.parse(resultJson);

        if (!result.success) {
            console.error("Paint App Error:", result.error);
            this.dependencies.ModalManager.request({
                context: "graphical",
                type: "alert",
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
        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
    }

    _updateStateFromPython(pyResult) {
        if (pyResult && pyResult.success && pyResult.data) {
            this.state.canvasData = pyResult.data.canvasData;
            this.state.canUndo = pyResult.data.canUndo;
            this.state.canRedo = pyResult.data.canRedo;
            this.state.isDirty = pyResult.data.isDirty;
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
            onUndo: () => this._updateStateFromPython(JSON.parse(OopisOS_Kernel.paintUndo())),
            onRedo: () => this._updateStateFromPython(JSON.parse(OopisOS_Kernel.paintRedo())),
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
                if (this.state.currentTool === 'fill') {
                    this._toolFill(coords);
                    this._pushUndoState();
                    this.state.isDrawing = false; // Fill is a single click, not a drag
                }
            },
            onCanvasMouseMove: (coords) => {
                this.ui.updateStatusBar(this.state, coords);
                if (!this.state.isDrawing) return;

                const tool = this.state.currentTool;
                if (tool === 'pencil' || tool === 'eraser') {
                    this._toolLine(this.state.lastCoords, coords, true);
                } else if (['line', 'rect', 'circle'].includes(tool)) {
                    this._previewShape(this.state.startCoords, coords);
                }
                this.state.lastCoords = coords; // Always update the last known coordinates
            },
            onCanvasMouseUp: (coords) => {
                if (!this.state.isDrawing) return;
                this.state.isDrawing = false;
                const tool = this.state.currentTool;
                const endCoords = coords || this.state.lastCoords;

                if (tool === 'fill') return; // Fill action is complete on mousedown

                if (['pencil', 'eraser'].includes(tool)) {
                    this._toolLine(this.state.lastCoords, endCoords, true);
                } else if (tool === 'line') {
                    this._toolLine(this.state.startCoords, endCoords);
                } else if (tool === 'rect') {
                    this._toolRect(this.state.startCoords, endCoords);
                } else if (tool === 'circle') {
                    this._toolCircle(this.state.startCoords, endCoords);
                }

                this.ui.clearPreview();
                if (tool !== 'select') {
                    this._pushUndoState();
                }
            },
        };
    }

    _pushUndoState() {
        const result = JSON.parse(OopisOS_Kernel.paintPushUndoState(JSON.stringify(this.state.canvasData)));
        this._updateStateFromPython(result);
    }

    _draw(cellsToUpdate, isPreview = false) {
        if (isPreview) {
            this.ui.updatePreviewCanvas(cellsToUpdate);
        } else {
            cellsToUpdate.forEach(cell => {
                if (this.state.canvasData[cell.y] && this.state.canvasData[cell.y][cell.x]) {
                    this.state.canvasData[cell.y][cell.x] = { char: cell.char, color: cell.color };
                }
            });
            this.ui.updateCanvas(cellsToUpdate);
        }
    }

    _previewShape(start, end) {
        if (!start || !end) return;
        const tool = this.state.currentTool;
        let cells = [];
        if (tool === 'line') {
            cells = this._getLineCells(start, end);
        } else if (tool === 'rect') {
            cells = this._getRectCells(start, end);
        } else if (tool === 'circle') {
            cells = this._getCircleCells(start, end);
        }
        this._draw(cells, true);
    }

    _toolLine(start, end, isPencil = false) {
        const cells = this._getLineCells(start, end, isPencil);
        this._draw(cells);
    }

    _toolRect(start, end) {
        const cells = this._getRectCells(start, end);
        this._draw(cells);
    }

    _toolCircle(start, end) {
        const cells = this._getCircleCells(start, end);
        this._draw(cells);
    }

    _toolFill(startCoords) {
        const { width, height } = this.state.canvasDimensions;
        const { x, y } = startCoords;
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const targetChar = this.state.canvasData[y][x].char;
        const targetColor = this.state.canvasData[y][x].color;
        const fillChar = this.state.currentCharacter;
        const fillColor = this.state.currentColor;
        if (targetChar === fillChar && targetColor === fillColor) return;
        const stack = [[x, y]];
        const visited = new Set([`${x},${y}`]);
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            if (this.state.canvasData[cy][cx].char === targetChar && this.state.canvasData[cy][cx].color === targetColor) {
                this.state.canvasData[cy][cx] = { char: fillChar, color: fillColor };
                const neighbors = [[cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]];
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                        visited.add(`${nx},${ny}`);
                    }
                }
            }
        }
        this.ui.renderInitialCanvas(this.state.canvasData, this.state.canvasDimensions);
    }

    _getLineCells(start, end, isPencil = false) {
        const cells = [];
        let { x: x1, y: y1 } = start;
        let { x: x2, y: y2 } = end;
        const char = this.state.currentTool === 'eraser' ? ' ' : this.state.currentCharacter;
        const color = this.state.currentTool === 'eraser' ? '#000000' : this.state.currentColor;
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = (x1 < x2) ? 1 : -1;
        const sy = (y1 < y2) ? 1 : -1;
        let err = dx - dy;
        while (true) {
            cells.push({ x: x1, y: y1, char, color });
            if ((x1 === x2) && (y1 === y2)) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x1 += sx; }
            if (e2 < dx) { err += dx; y1 += sy; }
        }
        return cells;
    }

    _getRectCells(start, end) {
        const cells = [];
        const { char, color } = { char: this.state.currentCharacter, color: this.state.currentColor };
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        for (let x = x1; x <= x2; x++) {
            cells.push({ x, y: y1, char, color });
            cells.push({ x, y: y2, char, color });
        }
        for (let y = y1 + 1; y < y2; y++) {
            cells.push({ x: x1, y, char, color });
            cells.push({ x: x2, y, char, color });
        }
        return cells;
    }

    _getCircleCells(start, end) {
        const cells = [];
        const { char, color } = { char: this.state.currentCharacter, color: this.state.currentColor };
        const centerX = Math.round((start.x + end.x) / 2);
        const centerY = Math.round((start.y + end.y) / 2);
        const rx = Math.abs(centerX - start.x);
        const ry = Math.abs(centerY - start.y);
        let x = 0, y = ry;
        let d1 = (ry * ry) - (rx * rx * ry) + (0.25 * rx * rx);
        let dx = 2 * ry * ry * x;
        let dy = 2 * rx * rx * y;
        while (dx < dy) {
            cells.push({ x: centerX + x, y: centerY + y, char, color }, { x: centerX - x, y: centerY + y, char, color }, { x: centerX + x, y: centerY - y, char, color }, { x: centerX - x, y: centerY - y, char, color });
            if (d1 < 0) { x++; dx += (2 * ry * ry); d1 += dx + (ry * ry); }
            else { x++; y--; dx += (2 * ry * ry); dy -= (2 * rx * rx); d1 += dx - dy + (ry * ry); }
        }
        let d2 = ((ry * ry) * ((x + 0.5) * (x + 0.5))) + ((rx * rx) * ((y - 1) * (y - 1))) - (rx * rx * ry * ry);
        while (y >= 0) {
            cells.push({ x: centerX + x, y: centerY + y, char, color }, { x: centerX - x, y: centerY + y, char, color }, { x: centerX + x, y: centerY - y, char, color }, { x: centerX - x, y: centerY - y, char, color });
            if (d2 > 0) { y--; dy -= (2 * rx * rx); d2 += (rx * rx) - dy; }
            else { y--; x++; dx += (2 * ry * ry); dy -= (2 * rx * rx); d2 += dx - dy + (rx * rx); }
        }
        return cells;
    }
};