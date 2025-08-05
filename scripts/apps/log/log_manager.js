/**
 * Log Manager - Manages the state and logic for the Log (journal) application.
 * @class LogManager
 * @extends App
 */
window.LogManager = class LogManager extends App {
  /**
   * Constructs a new LogManager instance.
   */
  constructor() {
    super();
    /** @type {object} The application's internal state. */
    this.state = {};
    /** @type {object} The dependency injection container. */
    this.dependencies = {};
    /** @type {object} A collection of UI callback functions. */
    this.callbacks = {};
    /** @type {LogUI|null} The UI component instance. */
    this.ui = null;
    /** @type {string} The default directory where log entries are stored. */
    this.LOG_DIR = "/home/Guest/.journal";
  }

  /**
   * Initializes and displays the Log application.
   * @param {HTMLElement} appLayer - The DOM element to append the app's UI to.
   * @param {object} [options={}] - Options for entering the application.
   * @returns {Promise<void>}
   */
  async enter(appLayer, options = {}) {
    if (this.isActive) return;
    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();

    this.isActive = true;
    this.state = {
      allEntries: [],
      filteredEntries: [],
      selectedPath: null,
      isDirty: false,
    };

    this.ui = new this.dependencies.LogUI(this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    appLayer.appendChild(this.container);

    await this._ensureLogDir();
    await this._loadEntries();

    this.ui.renderEntries(this.state.filteredEntries, null);
    this.ui.renderContent(null);
  }

  /**
   * Exits the Log application, prompting to save if there are unsaved changes.
   */
  exit() {
    if (!this.isActive) return;
    const { AppLayerManager, ModalManager } = this.dependencies;
    const performExit = () => {
      if (this.ui) {
        this.ui.reset();
      }
      AppLayerManager.hide(this);
      this.isActive = false;
      this.state = {};
      this.ui = null;
    };

    if (this.state.isDirty) {
      ModalManager.request({
        context: "graphical",
        type: "confirm",
        messageLines: [
          "You have unsaved changes that will be lost.",
          "Exit without saving?",
        ],
        onConfirm: performExit,
        onCancel: () => { },
      });
    } else {
      performExit();
    }
  }

  /**
   * Handles keyboard events for the application, specifically for saving and exiting.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  async handleKeyDown(event) {
    if (!this.isActive) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      await this.callbacks.onSave();
    } else if (event.key === "Escape") {
      this.exit();
    }
  }

  /**
   * Adds a new log entry instantly without launching the full UI.
   * @param {string} entryText - The text content of the new entry.
   * @param {string} currentUser - The name of the current user.
   * @returns {Promise<object>} An object indicating success or failure.
   */
  async quickAdd(entryText, currentUser) {
    const { FileSystemManager, UserManager } = this.dependencies;
    await this._ensureLogDir();
    const timestamp = new Date().toISOString();
    const filename = `${timestamp.replace(/[:.]/g, "-")}.md`;
    const fullPath = `${this.LOG_DIR}/${filename}`;

    const saveResult = await FileSystemManager.createOrUpdateFile(
        fullPath,
        entryText,
        {
          currentUser: currentUser,
          primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
        }
    );

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }
    await FileSystemManager.save();
    return {
      success: true,
      message: `Log entry saved to ${fullPath}`,
      path: fullPath,
    };
  }

  /**
   * Creates and returns a set of callback functions for UI events.
   * @private
   * @returns {object} An object containing the callback functions.
   */
  _createCallbacks() {
    return {
      /** Callback for exiting the application. */
      onExit: this.exit.bind(this),
      /**
       * Callback to filter entries based on a search query.
       * @param {string} query - The search query.
       */
      onSearch: (query) => {
        this.state.filteredEntries = this.state.allEntries.filter((e) =>
            e.content.toLowerCase().includes(query.toLowerCase())
        );
        this.ui.renderEntries(
            this.state.filteredEntries,
            this.state.selectedPath
        );
      },
      /**
       * Callback to select and display a specific log entry.
       * @param {string} path - The path of the selected entry.
       */
      onSelect: async (path) => {
        const { ModalManager } = this.dependencies;
        if (this.state.isDirty) {
          const confirmed = await new Promise((r) =>
              ModalManager.request({
                context: "graphical",
                type: "confirm",
                messageLines: ["You have unsaved changes. Discard them?"],
                onConfirm: () => r(true),
                onCancel: () => r(false),
              })
          );
          if (!confirmed) return;
        }
        this.state.selectedPath = path;
        const selectedEntry = this.state.allEntries.find(
            (e) => e.path === path
        );
        this.ui.renderContent(selectedEntry);
        this.ui.renderEntries(
            this.state.filteredEntries,
            this.state.selectedPath
        );
        this.state.isDirty = false;
        this.ui.updateSaveButton(false);
      },
      /** Callback to create a new log entry. */
      onNew: async () => {
        const { ModalManager, UserManager } = this.dependencies;
        const title = await new Promise((resolve) =>
            ModalManager.request({
              context: "graphical",
              type: "input",
              messageLines: ["Enter New Log Title:"],
              placeholder: "A new beginning...",
              onConfirm: (value) => resolve(value),
              onCancel: () => resolve(null),
            })
        );
        if (title) {
          const newContent = `# ${title}`;
          const result = await this.quickAdd(
              newContent,
              UserManager.getCurrentUser().name
          );
          if (result.success) {
            await this._loadEntries();
            await this.callbacks.onSelect(result.path);
          }
        }
      },
      /** Callback to save changes to the current log entry. */
      onSave: async () => {
        if (!this.state.selectedPath || !this.state.isDirty) return;
        const newContent = this.ui.getContent();
        const result = await this._saveEntry(
            this.state.selectedPath,
            newContent
        );
        if (result.success) {
          const entryIndex = this.state.allEntries.findIndex(
              (e) => e.path === this.state.selectedPath
          );
          if (entryIndex > -1) {
            this.state.allEntries[entryIndex].content = newContent;
          }
          this.state.isDirty = false;
          this.ui.updateSaveButton(false);
        } else {
          alert(`Error saving: ${result.error}`);
        }
      },
      /** Callback to handle changes in the editor content and update the dirty state. */
      onContentChange: () => {
        const selectedEntry = this.state.allEntries.find(
            (e) => e.path === this.state.selectedPath
        );
        if (!selectedEntry) return;
        const newContent = this.ui.getContent();
        this.state.isDirty = newContent !== selectedEntry.content;
        this.ui.updateSaveButton(this.state.isDirty);
      },
    };
  }

  /**
   * Saves a log entry to a file.
   * @param {string} path - The path to the file.
   * @param {string} content - The content to save.
   * @returns {Promise<object>} An object indicating success or failure.
   * @private
   */
  async _saveEntry(path, content) {
    const { FileSystemManager, UserManager } = this.dependencies;
    const result = await FileSystemManager.createOrUpdateFile(path, content, {
      currentUser: UserManager.getCurrentUser().name,
      primaryGroup: UserManager.getPrimaryGroupForUser(
          UserManager.getCurrentUser().name
      ),
    });
    if (result.success) await FileSystemManager.save();
    return result;
  }

  /**
   * Ensures the main log directory exists, creating it if necessary.
   * @returns {Promise<void>}
   * @private
   */
  async _ensureLogDir() {
    const { FileSystemManager, CommandExecutor } = this.dependencies;
    const pathInfo = FileSystemManager.validatePath(this.LOG_DIR, {
      allowMissing: true,
    });
    if (!pathInfo.data.node) {
      await CommandExecutor.processSingleCommand(`mkdir -p ${this.LOG_DIR}`, {
        isInteractive: false,
      });
    }
  }

  /**
   * Loads all log entries from the log directory into the application state.
   * @returns {Promise<void>}
   * @private
   */
  async _loadEntries() {
    const { FileSystemManager } = this.dependencies;
    this.state.allEntries = [];
    const dirNode = FileSystemManager.getNodeByPath(this.LOG_DIR);
    if (dirNode && dirNode.children) {
      for (const filename in dirNode.children) {
        if (filename.endsWith(".md")) {
          const fileNode = dirNode.children[filename];
          const rawTimestamp = filename.replace(".md", "");
          const isoString =
              rawTimestamp.substring(0, 10) +
              "T" +
              rawTimestamp.substring(11, 13) +
              ":" +
              rawTimestamp.substring(14, 16) +
              ":" +
              rawTimestamp.substring(17, 19) +
              "." +
              rawTimestamp.substring(20, 23) +
              "Z";
          this.state.allEntries.push({
            timestamp: new Date(isoString),
            content: fileNode.content || "",
            path: `${this.LOG_DIR}/${filename}`,
          });
        }
      }
    }
    this.state.allEntries.sort((a, b) => b.timestamp - a.timestamp);
    this.state.filteredEntries = [...this.state.allEntries];
  }
};