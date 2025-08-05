/**
 * Explorer User Interface - Manages the visual representation of the file explorer application.
 * @class ExplorerUI
 */
window.ExplorerUI = class ExplorerUI {
  /**
   * Constructs a new ExplorerUI instance.
   * @param {object} callbacks - An object containing callback functions for user interactions.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(callbacks, dependencies) {
    /** @type {object} A cache of DOM elements for the UI. */
    this.elements = {};
    /** @type {object} Callback functions for UI events. */
    this.callbacks = callbacks;
    /** @type {object} The dependency injection container. */
    this.dependencies = dependencies;
    /** @type {HTMLElement|null} The currently active context menu element. */
    this.activeContextMenu = null;

    this._buildLayout();
  }

  /**
   * Returns the main container element of the explorer.
   * @returns {HTMLElement} The root DOM element.
   */
  getContainer() {
    return this.elements.container;
  }

  /**
   * Builds the main UI layout, including the tree, main pane, and status bar.
   * @private
   */
  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('File Explorer', this.callbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;
    this.elements.footer = appWindow.footer;

    this.elements.treePane = Utils.createElement("div", {
      id: "explorer-tree-pane",
      className: "explorer__tree-pane",
    });
    this.elements.mainPane = Utils.createElement("div", {
      id: "explorer-main-pane",
      className: "explorer__main-pane",
    });

    this.elements.main.append(this.elements.treePane, this.elements.mainPane);

    this.elements.statusBar = this.elements.footer;

    this.elements.mainPane.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      const listItem = e.target.closest("li[data-path]");

      if (listItem) {
        const path = listItem.getAttribute("data-path");
        const name = listItem.querySelector(".explorer-item-name").textContent;
        const menuItems = [
          {
            label: "Rename...",
            callback: () => this.callbacks.onRename(path, name),
          },
          { label: "Delete", callback: () => this.callbacks.onDelete(path, name) },
          { label: "Move", callback: () => this.callbacks.onMove(path, null) },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      } else {
        const currentPath = this.elements.statusBar.textContent
            .split("  |")[0]
            .replace("Path: ", "");
        const menuItems = [
          {
            label: "New File...",
            callback: () => this.callbacks.onCreateFile(currentPath),
          },
          {
            label: "New Directory...",
            callback: () => this.callbacks.onCreateDirectory(currentPath),
          },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      }
    });

    document.addEventListener(
        "click",
        (e) => {
          if (this.activeContextMenu && !this.activeContextMenu.contains(e.target)) {
            this._removeContextMenu();
          }
        },
        true
    );
  }

  /**
   * Removes the active context menu from the DOM.
   * @private
   */
  _removeContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  /**
   * Creates and displays a context menu at a given position.
   * @private
   * @param {Array<object>} items - An array of menu item definitions.
   * @param {number} x - The x-coordinate for the menu.
   * @param {number} y - The y-coordinate for the menu.
   */
  _createContextMenu(items, x, y) {
    this._removeContextMenu();
    const { Utils } = this.dependencies;

    const menu = Utils.createElement("div", { className: "context-menu" });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.addEventListener("click", (e) => e.stopPropagation());

    items.forEach((item) => {
      if (item.separator) {
        menu.appendChild(
            Utils.createElement("div", { className: "context-menu-separator" })
        );
        return;
      }
      const menuItem = Utils.createElement("div", {
        className: "context-menu-item",
        textContent: item.label,
      });
      menuItem.addEventListener("click", () => {
        item.callback();
        this._removeContextMenu();
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    this.activeContextMenu = menu;
  }

  /**
   * Renders the file system directory tree in the left pane.
   * @param {object} treeData - The root node of the file system to display.
   * @param {string} selectedPath - The currently selected path.
   * @param {Set<string>} expandedPaths - A set of paths that should be shown as expanded.
   */
  renderTree(treeData, selectedPath, expandedPaths) {
    if (!this.elements.treePane) return;
    const { Utils, FileSystemManager, UserManager } = this.dependencies;
    const treeRoot = Utils.createElement("ul", { className: "explorer-tree" });

    const createTreeItem = (node, path, name) => {
      const hasChildren =
          node.children &&
          Object.keys(node.children).filter(
              (childName) => node.children[childName].type === "directory"
          ).length > 0;
      const canRead = FileSystemManager.hasPermission(
          node,
          UserManager.getCurrentUser().name,
          "read"
      );

      const summary = Utils.createElement("summary");
      const folderIcon = Utils.createElement("span", {
        className: "mr-1",
        textContent: "📁",
      });
      const nameSpan = Utils.createElement("span", { textContent: name });
      summary.append(folderIcon, nameSpan);

      if (!canRead) {
        summary.classList.add("opacity-50", "italic");
      }

      const details = Utils.createElement(
          "details",
          { className: "explorer-tree-item", "data-path": path },
          summary
      );
      if (expandedPaths.has(path)) {
        details.open = true;
      }

      if (canRead && hasChildren) {
        const childList = Utils.createElement("ul", { className: "pl-4" });
        const sortedChildNames = Object.keys(node.children).sort();

        for (const childName of sortedChildNames) {
          const childNode = node.children[childName];
          if (childNode.type === "directory") {
            childList.appendChild(
                createTreeItem(
                    childNode,
                    `${path === "/" ? "" : path}/${childName}`,
                    childName
                )
            );
          }
        }
        details.appendChild(childList);
      }

      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (canRead) {
          this.callbacks.onTreeItemSelect(path);
        }
      });

      if (path === selectedPath) {
        summary.classList.add("selected");
      }

      return details;
    }

    treeRoot.appendChild(createTreeItem(treeData, "/", "/"));
    this.elements.treePane.innerHTML = "";
    this.elements.treePane.appendChild(treeRoot);
  }

  /**
   * Renders the file and directory list in the main pane.
   * @param {Array<object>} items - An array of file/directory item objects to display.
   * @param {string} currentPath - The path of the directory whose contents are being displayed.
   */
  renderMainPane(items, currentPath) {
    if (!this.elements.mainPane) return;
    const { Utils, FileSystemManager } = this.dependencies;
    this.elements.mainPane.innerHTML = "";

    this.elements.mainPane.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menuItems = [
        {
          label: "New File...",
          callback: () => this.callbacks.onCreateFile(currentPath),
        },
        {
          label: "New Directory...",
          callback: () => this.callbacks.onCreateDirectory(currentPath),
        },
      ];
      this._createContextMenu(menuItems, e.clientX, e.clientY);
    });

    if (items.length === 0) {
      this.elements.mainPane.appendChild(
          Utils.createElement("div", {
            className: "p-4 text-zinc-500",
            textContent: "(Directory is empty)",
          })
      );
      return;
    }

    const list = Utils.createElement("ul", { className: "explorer-file-list" });
    items.forEach((item) => {
      const icon = Utils.createElement("span", {
        className: "mr-2 w-4 inline-block",
        textContent: item.type === "directory" ? "📁" : "📄",
      });
      const name = Utils.createElement("span", {
        className: "explorer-item-name",
        textContent: item.name,
      });
      const perms = Utils.createElement("span", {
        className: "explorer-item-perms",
        textContent: FileSystemManager.formatModeToString(item.node),
      });
      const size = Utils.createElement("span", {
        className: "explorer-item-size",
        textContent: item.type === "file" ? Utils.formatBytes(item.size) : "",
      });

      const li = Utils.createElement(
          "li",
          {
            "data-path": item.path,
            title: item.path,
          },
          icon,
          name,
          perms,
          size
      );

      li.addEventListener("dblclick", () =>
          this.callbacks.onMainItemActivate(item.path, item.type)
      );

      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const menuItems = [
          {
            label: "Rename...",
            callback: () => this.callbacks.onRename(item.path, item.name),
          },
          {
            label: "Delete",
            callback: () => this.callbacks.onDelete(item.path, item.name),
          },
          { label: "Move", callback: () => this.callbacks.onMove(item.path, null) },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      });

      list.appendChild(li);
    });
    this.elements.mainPane.appendChild(list);
  }

  /**
   * Updates the status bar at the bottom of the window.
   * @param {string} path - The current path.
   * @param {number|string} itemCount - The number of items in the current directory.
   */
  updateStatusBar(path, itemCount) {
    if (!this.elements.statusBar) return;
    this.elements.statusBar.textContent = `Path: ${path}  |  Items: ${itemCount}`;
  }

  /**
   * Sets the cursor style to indicate a move operation is active.
   * @param {boolean} isMoving - Whether a move operation is in progress.
   */
  setMoveCursor(isMoving) {
    if (this.elements.container) {
      this.elements.container.style.cursor = isMoving ? "move" : "default";
    }
  }

  /**
   * Applies or removes a highlight to a specific item in the main pane.
   * @param {string} path - The path of the item to highlight.
   * @param {boolean} isHighlighted - Whether to add or remove the highlight.
   */
  highlightItem(path, isHighlighted) {
    const allItems = this.elements.mainPane.querySelectorAll("li");
    allItems.forEach((li) => {
      li.style.backgroundColor = "";
      li.style.color = "";
    });

    if (isHighlighted) {
      const itemElement = this.elements.mainPane.querySelector(
          `[data-path="${path}"]`
      );
      if (itemElement) {
        itemElement.style.backgroundColor = "var(--color-info)";
        itemElement.style.color = "var(--color-background-darkest)";
      }
    }
  }

  /**
   * Resets the UI state and clears all DOM elements.
   */
  reset() {
    this._removeContextMenu();
    this.elements = {};
    this.callbacks = {};
  }
};