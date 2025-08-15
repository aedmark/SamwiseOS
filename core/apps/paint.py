# gem/core/apps/paint.py
import json

class PaintManager:
    """Manages the state and logic for the Paint application."""

    def __init__(self):
        self.reset()

    def _get_blank_canvas(self, width, height):
        """Creates an empty canvas data structure."""
        return [[{"char": " ", "color": "#000000"} for _ in range(width)] for _ in range(height)]

    def reset(self):
        """Resets the paint state to default values."""
        self.current_file_path = None
        self.canvas_dimensions = {"width": 80, "height": 24}
        self.canvas_data = self._get_blank_canvas(
            self.canvas_dimensions["width"], self.canvas_dimensions["height"]
        )
        self.undo_stack = [json.dumps(self.canvas_data)]
        self.redo_stack = []
        self.is_dirty = False

    def get_initial_state(self, file_path, file_content):
        """Loads a .oopic file or creates a new canvas, returning the full initial state."""
        self.reset()
        self.current_file_path = file_path

        if file_content:
            try:
                parsed_content = json.loads(file_content)
                if isinstance(parsed_content, dict) and 'dimensions' in parsed_content and 'cells' in parsed_content:
                    self.canvas_dimensions = parsed_content['dimensions']
                    self.canvas_data = parsed_content['cells']
                    self.undo_stack = [json.dumps(self.canvas_data)]
            except (json.JSONDecodeError, TypeError):
                self.canvas_data = self._get_blank_canvas(
                    self.canvas_dimensions["width"], self.canvas_dimensions["height"]
                )
        else:
            self.canvas_data = self._get_blank_canvas(
                self.canvas_dimensions["width"], self.canvas_dimensions["height"]
            )

        return self._get_state_for_ui()

    def _get_state_for_ui(self):
        """Returns a dictionary of the current state for the UI."""
        return {
            "filePath": self.current_file_path,
            "canvasDimensions": self.canvas_dimensions,
            "canvasData": self.canvas_data,
            "canUndo": len(self.undo_stack) > 1,
            "canRedo": len(self.redo_stack) > 0,
            "isDirty": self.is_dirty
        }

    def push_undo_state(self, new_canvas_data_json):
        """Pushes a new canvas state to the undo stack."""
        if new_canvas_data_json != self.undo_stack[-1]:
            self.canvas_data = json.loads(new_canvas_data_json)
            self.undo_stack.append(new_canvas_data_json)
            if len(self.undo_stack) > 50:
                self.undo_stack.pop(0)
            self.redo_stack = []
            self.is_dirty = True
        return self._get_state_for_ui()

    def undo(self):
        """Reverts to the previous canvas state."""
        if len(self.undo_stack) > 1:
            current_state = self.undo_stack.pop()
            self.redo_stack.append(current_state)
            self.canvas_data = json.loads(self.undo_stack[-1])
            self.is_dirty = len(self.undo_stack) > 1
        return self._get_state_for_ui()

    def redo(self):
        """Re-applies a canvas state from the redo stack."""
        if self.redo_stack:
            next_state = self.redo_stack.pop()
            self.undo_stack.append(next_state)
            self.canvas_data = json.loads(next_state)
            self.is_dirty = True
        return self._get_state_for_ui()

    def update_on_save(self, path):
        """Updates the state after a successful save operation."""
        self.current_file_path = path
        self.is_dirty = False
        self.undo_stack = [json.dumps(self.canvas_data)]
        self.redo_stack = []
        return self._get_state_for_ui()

    def _get_line_cells(self, x1, y1, x2, y2, char, color):
        """Bresenham's line algorithm to get all cells between two points."""
        cells = []
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        err = dx - dy
        while True:
            cells.append({"x": x1, "y": y1, "char": char, "color": color})
            if x1 == x2 and y1 == y2:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x1 += sx
            if e2 < dx:
                err += dx
                y1 += sy
        return cells

    def draw_shape(self, shape_type, start, end, char, color, brush_size):
        """The main entry point for all drawing operations."""
        # For pencil/eraser, we just draw a line between the last known coordinates
        # to create a continuous stroke. This is a simplified approach.
        if shape_type in ['pencil', 'eraser']:
            char = ' ' if shape_type == 'eraser' else char
            color = '#000000' if shape_type == 'eraser' else color
            cells = self._get_line_cells(start['x'], start['y'], end['x'], end['y'], char, color)
            for cell in cells:
                if 0 <= cell['y'] < self.canvas_dimensions['height'] and 0 <= cell['x'] < self.canvas_dimensions['width']:
                    self.canvas_data[cell['y']][cell['x']] = {"char": cell['char'], "color": cell['color']}

        # After any drawing operation, we mark the canvas as dirty
        self.is_dirty = True

        # We'll push the state to the undo stack in a separate step
        # to ensure it's done after a complete user action (like releasing the mouse).
        return self._get_state_for_ui()

# Instantiate a singleton for the kernel
paint_manager = PaintManager()