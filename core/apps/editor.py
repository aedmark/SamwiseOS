# gem/core/apps/editor.py

class EditorManager:
    """Manages the state and logic for the text editor application."""
    def __init__(self):
        self.reset()

    def reset(self):
        """Resets the editor to a default state."""
        self.current_file_path = None
        self.original_content = ""
        self.undo_stack = [""]
        self.redo_stack = []

    def load_file(self, file_path, file_content):
        """Loads a file into the editor, setting its initial state."""
        self.current_file_path = file_path
        self.original_content = file_content or ""
        self.undo_stack = [self.original_content]
        self.redo_stack = []
        return self.get_state()

    def get_state(self):
        """Returns the current state of the editor for the UI."""
        return {
            "filePath": self.current_file_path,
            "originalContent": self.original_content,
            "canUndo": len(self.undo_stack) > 1,
            "canRedo": len(self.redo_stack) > 0
        }

    def push_undo_state(self, content):
        """Pushes a new content state to the undo stack."""
        # To avoid flooding the stack, only add if content has changed
        if content != self.undo_stack[-1]:
            self.undo_stack.append(content)
            # Limit stack size for performance
            if len(self.undo_stack) > 50:
                self.undo_stack.pop(0)
            # A new action clears the redo stack
            self.redo_stack = []
        return self.get_state()

    def undo(self):
        """Reverts the content to the previous state in the undo stack."""
        if len(self.undo_stack) > 1:
            current_state = self.undo_stack.pop()
            self.redo_stack.append(current_state)
            return {"content": self.undo_stack[-1], **self.get_state()}
        return None # Can't undo

    def redo(self):
        """Re-applies a content state from the redo stack."""
        if self.redo_stack:
            next_state = self.redo_stack.pop()
            self.undo_stack.append(next_state)
            return {"content": next_state, **self.get_state()}
        return None # Can't redo

    def update_on_save(self, path, content):
        """Updates the editor's state after a successful save."""
        self.current_file_path = path
        self.original_content = content
        # After saving, the current state is the new "original"
        # We can clear the undo/redo stacks or just mark the current state as clean
        # For simplicity, we'll consider the saved content the new baseline
        self.undo_stack = [content]
        self.redo_stack = []
        return self.get_state()

# Instantiate a singleton that will be exposed to JavaScript via the kernel
editor_manager = EditorManager()