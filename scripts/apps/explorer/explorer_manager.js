/**
 * Explorer Application Manager - Provides a graphical file explorer interface
 * @class ExplorerManager
 * @extends App
 */
window.ExplorerManager = class ExplorerManager extends App {
  /**
   * Creates a new ExplorerManager instance.
   */
  constructor() {
    super();
    /** @type {string} The current path being viewed in the main pane. */
    this.currentPath = "/";
    /** @type {Set<string>} A set of paths that are currently expanded in the directory tree. */
    this.expandedPaths = new Set(["/"]);
    /** @type {object} State for a file move operation. */
    this.moveOperation = {
      active: false,
      sourcePath: null,
    };
    /** @type {object} The dependency injection container. */
    this.dependencies = {};
    /** @type {object} The callback functions for UI events. */
    this.callbacks = {};
    /** @type {ExplorerUI|null} The UI component instance. */
    this.ui = null;
  }

  /**
   * Initializes and displays the explorer interface.
   * @param {HTMLElement} appLayer - The DOM element to append the explorer's UI to.
   * @param {object} [options={}] - Options for entering the application, including the starting path.
   */
  async enter(appLayer, options = {}) {
    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();

    const { FileSystemManager, OutputManager, ExplorerUI } = this.dependencies;
    const startPath = options.startPath || FileSystemManager.getCurrentPath();
    const pathValidation = FileSystemManager.validatePath(startPath, {
      allowMissing: false,
    });

    if (!pathValidation.success) {
      await OutputManager.appendToOutput(`explore: ${pathValidation.error}`, {
        typeClass: "text-error",
      });
      return;
    }

    const { node: startNode } = pathValidation.data;
    let initialPath = startPath;
    if (startNode.type !== "directory") {
      initialPath =
          initialPath.substring(0, initialPath.lastIndexOf("/")) || "/";
    }

    this.isActive = true;
    this.expandedPaths = new Set(["/"]);
    let parent = initialPath;
    while (parent && parent !== "/") {
      this.expandedPaths.add(parent);
      parent =
          parent.substring(0, parent.lastIndexOf("/")) ||
          (parent.includes("/") ? "/" : null);
    }

    this.ui = new ExplorerUI(this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    this.container.setAttribute("tabindex", "-1");
    appLayer.appendChild(this.container);

    this._updateView(initialPath);
  }

  /**
   * Exits the explorer, cleaning up UI and state.
   */
  exit() {
    if (!this.isActive) return;
    const { AppLayerManager } = this.dependencies;
    if (this.moveOperation.active) {
      this._resetMoveOperation();
    }

    if (this.ui) {
      this.ui.reset();
    }
    AppLayerManager.hide(this);
    this.isActive = false;
    this.ui = null;
  }

  /**
   * Handles keyboard events for the application.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  handleKeyDown(event) {
    if (event.key === "Escape") {
      if (this.moveOperation.active) {
        this.callbacks.onCancelMove();
      } else {
        this.exit();
      }
    }
  }

  /**
   * Creates and returns a set of callback functions for UI events.
   * @private
   * @returns {object} An object containing the callback functions.
   */
  _createCallbacks() {
    return {
      onExit: this.exit.bind(this),
      onTreeItemSelect: (path) => {
        if (this.moveOperation.active) {
          this.callbacks.onMove(this.moveOperation.sourcePath, path);
          return;
        }
        if (path !== "/") {
          this.expandedPaths.has(path)
              ? this.expandedPaths.delete(path)
              : this.expandedPaths.add(path);
        }
        this._updateView(path);
      },
      onMainItemActivate: async (path, type) => {
        const { CommandExecutor } = this.dependencies;
        if (type === "directory") {
          this.expandedPaths.add(path);
          this._updateView(path);
        } else {
          this.exit();
          await new Promise((resolve) => setTimeout(resolve, 50));
          await CommandExecutor.processSingleCommand(`edit "${path}"`, {
            isInteractive: true,
          });
        }
      },
      onCreateFile: (path) => {
        const { ModalManager, FileSystemManager, UserManager } = this.dependencies;
        ModalManager.request({
          context: "graphical",
          type: "input",
          messageLines: ["Enter New File Name:"],
          placeholder: "new_file.txt",
          onConfirm: async (name) => {
            if (name) {
              const newFilePath = `${path === "/" ? "" : path}/${name}`;
              const result = await FileSystemManager.createOrUpdateFile(
                  newFilePath,
                  "",
                  {
                    currentUser: UserManager.getCurrentUser().name,
                    primaryGroup: UserManager.getPrimaryGroupForUser(
                        UserManager.getCurrentUser().name
                    ),
                  }
              );
              if (result.success) {
                await FileSystemManager.save();
                this._updateView(this.currentPath);
              } else {
                const errorMessage = result.error.message || result.error;
                const errorSuggestion = result.error.suggestion || "Please check the path and your permissions.";
                ModalManager.request({
                  context: "graphical",
                  type: "confirm",
                  messageLines: [`Error: ${errorMessage}`, `Suggestion: ${errorSuggestion}`],
                  confirmText: "OK",
                  cancelText: null
                });
              }
            }
          },
          onCancel: () => { },
        });
      },
      onCreateDirectory: (path) => {
        const { ModalManager, CommandExecutor } = this.dependencies;
        ModalManager.request({
          context: "graphical",
          type: "input",
          messageLines: ["Enter New Directory Name:"],
          placeholder: "new_directory",
          onConfirm: async (name) => {
            if (name) {
              await CommandExecutor.processSingleCommand(
                  `mkdir "${path === "/" ? "" : path}/${name}"`,
                  { isInteractive: false }
              );
              this._updateView(this.currentPath);
            }
          },
          onCancel: () => { },
        });
      },
      onRename: (path, oldName) => {
        const { ModalManager, CommandExecutor } = this.dependencies;
        ModalManager.request({
          context: "graphical",
          type: "input",
          messageLines: [`Rename "${oldName}":`],
          placeholder: oldName,
          onConfirm: async (newName) => {
            if (newName && newName !== oldName) {
              const newPath = `${this.currentPath === "/" ? "" : this.currentPath}/${newName}`;
              await CommandExecutor.processSingleCommand(
                  `mv "${path}" "${newPath}"`,
                  { isInteractive: false }
              );
              this._updateView(this.currentPath);
            }
          },
          onCancel: () => { },
        });
      },
      onDelete: (path, name) => {
        const { ModalManager, CommandExecutor } = this.dependencies;
        ModalManager.request({
          context: "graphical",
          type: "confirm",
          messageLines: [
            `Are you sure you want to delete "${name}"?`,
            "This action cannot be undone.",
          ],
          onConfirm: async () => {
            await CommandExecutor.processSingleCommand(`rm -r "${path}"`, {
              isInteractive: false,
            });
            this._updateView(this.currentPath);
          },
          onCancel: () => { },
        });
      },
      onMove: (sourcePath, destPath) => {
        const { CommandExecutor } = this.dependencies;
        if (!this.moveOperation.active) {
          this.moveOperation.active = true;
          this.moveOperation.sourcePath = sourcePath;
          this.ui.setMoveCursor(true);
          this.ui.highlightItem(sourcePath, true);
          return;
        }
        CommandExecutor.processSingleCommand(
            `mv "${sourcePath}" "${destPath}/"`,
            {
              isInteractive: false,
            }
        ).then(() => {
          this._resetMoveOperation();
          this._updateView(this.currentPath);
        });
      },
      onCancelMove: () => {
        this._resetMoveOperation();
        this._updateView(this.currentPath);
      },
    };
  }

  /**
   * Resets the internal state of a move operation.
   * @private
   */
  _resetMoveOperation() {
    this.moveOperation.active = false;
    this.moveOperation.sourcePath = null;
    if (this.ui) {
      this.ui.setMoveCursor(false);
    }
  }

  /**
   * Renders the UI to display the contents of a given path.
   * @param {string} path - The path to render.
   * @private
   */
  _updateView(path) {
    if (!this.ui) return;
    const { UserManager, FileSystemManager } = this.dependencies;
    this.currentPath = path;
    const currentUser = UserManager.getCurrentUser().name;
    const rootNode = FileSystemManager.getNodeByPath("/");
    if (!rootNode) {
      console.error("CRITICAL: Root node not found in ExplorerManager.");
      this.exit();
      return;
    }

    this.ui.renderTree(rootNode, this.currentPath, this.expandedPaths);

    const mainNode = FileSystemManager.getNodeByPath(this.currentPath);
    if (
        mainNode &&
        FileSystemManager.hasPermission(mainNode, currentUser, "read")
    ) {
      const items = Object.keys(mainNode.children || {})
          .sort((a, b) => {
            const nodeA = mainNode.children[a];
            const nodeB = mainNode.children[b];
            if (nodeA.type === "directory" && nodeB.type !== "directory")
              return -1;
            if (nodeA.type !== "directory" && nodeB.type === "directory")
              return 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const childNode = mainNode.children[name];
            return {
              name,
              path: `${this.currentPath === "/" ? "" : this.currentPath}/${name}`,
              type: childNode.type,
              node: childNode,
              size: FileSystemManager.calculateNodeSize(childNode),
            };
          });
      this.ui.renderMainPane(items, this.currentPath);
      this.ui.updateStatusBar(this.currentPath, items.length);
    } else {
      this.ui.renderMainPane([], this.currentPath);
      this.ui.updateStatusBar(this.currentPath, "Permission Denied");
    }
  }
};