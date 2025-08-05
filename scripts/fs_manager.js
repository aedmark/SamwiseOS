// scripts/fs_manager.js

/**
 * @typedef {object} FileSystemNode
 * @property {string} type - 'file', 'directory', or 'symlink'.
 * @property {string} owner - The name of the user who owns the node.
 * @property {string} group - The name of the group that owns the node.
 * @property {number} mode - The octal permission mode (e.g., 0o755).
 * @property {string} mtime - The last modification timestamp in ISO format.
 * @property {object} [children] - An object containing child nodes (for directories).
 * @property {string} [content] - The file content (for files).
 * @property {string} [target] - The path the symlink points to (for symbolic links).
 */

/**
 * Manages the entire virtual filesystem state, including user permissions,
 * file operations, and persistence to the underlying storage layer.
 * This is the central hub for all file-related activities.
 * @class FileSystemManager
 */
class FileSystemManager {
  /**
   * @constructor
   * @param {object} config - The global configuration object.
   */
  constructor(config) {
    this.config = config;
    /** @type {object.<string, FileSystemNode>} The in-memory representation of the filesystem. */
    this.fsData = {};
    /** @type {string} The current working directory. */
    this.currentPath = this.config.FILESYSTEM.ROOT_PATH;
    /** @type {object} The dependency injection container. */
    this.dependencies = {};
    /** @type {object} The storage abstraction layer for persistence. */
    this.storageHAL = null;
  }

  /**
   * Sets the dependency injection container and initializes sub-managers.
   * @param {object} dependencies - The dependencies to be injected.
   */
  setDependencies(dependencies) {
    this.dependencies = dependencies;
    this.userManager = dependencies.UserManager;
    this.groupManager = dependencies.GroupManager;
    this.storageHAL = dependencies.StorageHAL;
  }

  /**
   * Initializes the filesystem with a default structure and essential files.
   * This is our 'Genesis' block, setting up the basic world for our users.
   * @param {string} guestUsername - The default guest user's name.
   * @returns {Promise<void>}
   */
  async initialize(guestUsername) {
    const nowISO = new Date().toISOString();
    this.fsData = {
      [this.config.FILESYSTEM.ROOT_PATH]: {
        type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
        children: {
          home: {
            type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {},
            owner: "root",
            group: "root",
            mode: 0o755,
            mtime: nowISO,
          },
          etc: {
            type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {
              'sudoers': {
                type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
                content: "# /etc/sudoers\n#\n# This file MUST be edited with the 'visudo' command as root.\n\nroot ALL=(ALL) ALL\n%root ALL=(ALL) ALL\n",
                owner: 'root',
                group: 'root',
                mode: 0o440,
                mtime: nowISO,
              },
              'agenda.json': {
                type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
                content: "[]",
                owner: 'root',
                group: 'root',
                mode: 0o644,
                mtime: nowISO,
              }
            },
            owner: "root",
            group: "root",
            mode: 0o755,
            mtime: nowISO,
          },
          var: {
            type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {
              log: {
                type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                children: {
                  'bulletin.md': {
                    type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
                    content: "# OopisOS Town Bulletin\n",
                    owner: "root",
                    group: "towncrier",
                    mode: 0o666,
                    mtime: nowISO,
                  },
                  'audit.log': {
                    type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
                    content: `# OopisOS Audit Log v1.0\n`,
                    owner: "root",
                    group: "root",
                    mode: 0o640, // rw-r-----
                    mtime: nowISO,
                  }
                },
                owner: "root",
                group: "root",
                mode: 0o755,
                mtime: nowISO,
              }
            },
            owner: "root",
            group: "root",
            mode: 0o755,
            mtime: nowISO,
          },
        },
        owner: "root",
        group: "root",
        mode: this.config.FILESYSTEM.DEFAULT_DIR_MODE,
        mtime: nowISO,
      },
    };
    await this.createUserHomeDirectory("root");
    await this.createUserHomeDirectory(guestUsername);
  }

  /**
   * Creates a home directory for a specified user if it doesn't already exist.
   * This is where a user's journey begins.
   * @param {string} username - The name of the user.
   * @returns {Promise<void>}
   */
  async createUserHomeDirectory(username) {
    if (!this.fsData["/"]?.children?.home) {
      console.error(
          "FileSystemManager: Cannot create user home directory, /home does not exist."
      );
      return;
    }
    const homeDirNode = this.fsData["/"].children.home;
    if (!homeDirNode.children[username]) {
      homeDirNode.children[username] = {
        type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
        children: {},
        owner: username,
        group: username,
        mode: 0o755,
        mtime: new Date().toISOString(),
      };
      homeDirNode.mtime = new Date().toISOString();
    }
  }

  /**
   * Saves the entire in-memory filesystem to persistent storage.
   * This commits all changes and makes them permanent.
   * @returns {Promise<object>} A promise that resolves to a success or error object.
   */
  async save() {
    const { ErrorHandler, Utils } = this.dependencies;
    const saveData = Utils.deepCopyNode(this.fsData);
    const success = await this.storageHAL.save(saveData);
    if (success) {
      return ErrorHandler.createSuccess();
    }
    return ErrorHandler.createError("OopisOs failed to save the file system.");
  }

  /**
   * Loads the entire filesystem from persistent storage.
   * If no data is found, it initializes a new, pristine filesystem.
   * @returns {Promise<object>} A promise that resolves to a success or error object.
   */
  async load() {
    const { ErrorHandler, OutputManager } = this.dependencies;
    const loadedData = await this.storageHAL.load();

    if (loadedData) {
      this.fsData = loadedData;
      // --- Migration: Ensure essential files exist ---
      const etcNode = this.fsData['/']?.children?.etc;
      if (etcNode && etcNode.type === 'directory') {
        const nowISO = new Date().toISOString();
        let needsSave = false;

        if (!etcNode.children['sudoers']) {
          etcNode.children['sudoers'] = {
            type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
            content: "# /etc/sudoers\n#\n# This file MUST be edited with the 'visudo' command as root.\n\nroot ALL=(ALL) ALL\n%root ALL=(ALL) ALL\n",
            owner: 'root',
            group: 'root',
            mode: 0o440,
            mtime: nowISO,
          };
          console.log("FileSystem Migration: Created missing /etc/sudoers file.");
          needsSave = true;
        }

        if (!etcNode.children['agenda.json']) {
          etcNode.children['agenda.json'] = {
            type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
            content: "[]",
            owner: 'root',
            group: 'root',
            mode: 0o644,
            mtime: nowISO,
          };
          console.log("FileSystem Migration: Created missing /etc/agenda.json file.");
          needsSave = true;
        }

        if (needsSave) {
          etcNode.mtime = nowISO;
          await this.save();
        }
      }
    } else {
      await OutputManager.appendToOutput(
          "No file system found. Initializing new one.",
          { typeClass: this.config.CSS_CLASSES.CONSOLE_LOG_MSG }
      );
      await this.initialize(this.config.USER.DEFAULT_NAME);
      await this.save();
    }
    return ErrorHandler.createSuccess();
  }

  /**
   * Clears all filesystem data from persistent storage.
   * This is a one-way ticket to a clean slate, so be careful.
   * @returns {Promise<object>} A promise that resolves to a success or error object.
   */
  async clearAllFS() {
    const success = await this.storageHAL.clear();
    if (success) {
      return this.dependencies.ErrorHandler.createSuccess();
    }
    return this.dependencies.ErrorHandler.createError("Could not clear all user file systems.");
  }

  /**
   * Retrieves the current working directory.
   * @returns {string} The current path.
   */
  getCurrentPath() {
    return this.currentPath;
  }

  /**
   * Sets the current working directory.
   * @param {string} path - The new current path.
   */
  setCurrentPath(path) {
    this.currentPath = path;
  }

  /**
   * Retrieves the raw in-memory filesystem data object.
   * @returns {object} The filesystem data.
   */
  getFsData() {
    return this.fsData;
  }

  /**
   * Sets the in-memory filesystem data to a new object.
   * This is how we restore from a backup or reset to a new state.
   * @param {object} newData - The new filesystem data.
   */
  setFsData(newData) {
    this.fsData = newData;
  }

  /**
   * Converts a relative path and a base path into an absolute path.
   * It's like finding your way on a map with a compass.
   * @param {string} targetPath - The relative or absolute path to resolve.
   * @param {string} [basePath] - The base path to resolve from.
   * @returns {string} The absolute path.
   */
  getAbsolutePath(targetPath, basePath) {
    basePath = basePath || this.currentPath;
    if (!targetPath) targetPath = this.config.FILESYSTEM.CURRENT_DIR_SYMBOL;
    let effectiveBasePath = basePath;
    if (targetPath.startsWith(this.config.FILESYSTEM.PATH_SEPARATOR))
      effectiveBasePath = this.config.FILESYSTEM.ROOT_PATH;

    const baseSegments =
        effectiveBasePath === this.config.FILESYSTEM.ROOT_PATH
            ? []
            : effectiveBasePath
                .substring(1)
                .split(this.config.FILESYSTEM.PATH_SEPARATOR)
                .filter((s) => s && s !== this.config.FILESYSTEM.CURRENT_DIR_SYMBOL && s !== this.config.FILESYSTEM.PARENT_DIR_SYMBOL);

    let resolvedSegments = [...baseSegments];
    const targetSegments = targetPath.split(this.config.FILESYSTEM.PATH_SEPARATOR);

    for (const segment of targetSegments) {
      if (segment === "" || segment === this.config.FILESYSTEM.CURRENT_DIR_SYMBOL) {
        continue;
      }
      if (segment === this.config.FILESYSTEM.PARENT_DIR_SYMBOL) {
        if (resolvedSegments.length > 0) resolvedSegments.pop();
      } else {
        const sanitizedSegment = segment.replace(/[\\/&<>"']/g, '');
        if (sanitizedSegment) {
          resolvedSegments.push(sanitizedSegment);
        }
      }
    }

    if (resolvedSegments.length === 0) return this.config.FILESYSTEM.ROOT_PATH;
    return (
        this.config.FILESYSTEM.PATH_SEPARATOR +
        resolvedSegments.join(this.config.FILESYSTEM.PATH_SEPARATOR)
    );
  }

  /**
   * Creates a new symbolic link node.
   * @private
   * @param {string} targetPath - The path the symlink points to.
   * @param {string} owner - The owner of the link.
   * @param {string} group - The group of the link.
   * @returns {FileSystemNode} The new symbolic link node.
   */
  _createNewSymlinkNode(targetPath, owner, group) {
    return {
      type: this.config.FILESYSTEM.SYMBOLIC_LINK_TYPE,
      target: targetPath,
      owner: owner,
      group: group,
      mode: 0o777,
      mtime: new Date().toISOString()
    };
  }

  /**
   * Traverses the filesystem tree to find and return a node by its absolute path.
   * @param {string} absolutePath - The absolute path of the node to find.
   * @param {object} [options={}] - Options for path resolution.
   * @param {boolean} [options.resolveLastSymlink=true] - Whether to follow the final symbolic link in the path.
   * @returns {FileSystemNode|null} The filesystem node or null if not found.
   */
  getNodeByPath(absolutePath, options = {}) {
    const { resolveLastSymlink = true } = options;
    const MAX_SYMLINK_DEPTH = 10;
    const currentUser = this.dependencies.UserManager.getCurrentUser().name;

    let currentPath = absolutePath;
    for (let depth = 0; depth < MAX_SYMLINK_DEPTH; depth++) {
      if (currentPath === this.config.FILESYSTEM.ROOT_PATH) {
        return this.fsData[this.config.FILESYSTEM.ROOT_PATH];
      }

      const segments = currentPath.substring(1).split(this.config.FILESYSTEM.PATH_SEPARATOR).filter(s => s);
      let currentNode = this.fsData[this.config.FILESYSTEM.ROOT_PATH];
      let pathTraversedSoFar = '/';

      let pathResolved = true;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;

        if (currentNode.type !== this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
          return null;
        }
        if (!this.hasPermission(currentNode, currentUser, "execute")) {
          return null;
        }
        if (!currentNode.children || !currentNode.children[segment]) {
          return null;
        }

        currentNode = currentNode.children[segment];
        pathTraversedSoFar = this.getAbsolutePath(segment, pathTraversedSoFar);

        if (currentNode.type === this.config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
          if (isLastSegment && !resolveLastSymlink) {
            return currentNode;
          }

          const parentOfLink = pathTraversedSoFar.substring(0, pathTraversedSoFar.lastIndexOf('/')) || '/';
          const targetPath = this.getAbsolutePath(currentNode.target, parentOfLink);
          const remainingSegments = segments.slice(i + 1);

          currentPath = remainingSegments.length > 0
              ? this.getAbsolutePath(remainingSegments.join('/'), targetPath)
              : targetPath;

          pathResolved = false;
          break;
        }
      }

      if (pathResolved) {
        return currentNode;
      }
    }

    console.error(`getNodeByPath: Too many levels of symbolic links for path '${absolutePath}'`);
    return null;
  }

  /**
   * Validates a given path against a set of rules, including existence, type, and permissions.
   * This is like checking an ID before letting someone into the club.
   * @param {string} pathArg - The path to validate.
   * @param {object} options - Validation options.
   * @returns {object} A success or error object with validation data.
   */
  validatePath(pathArg, options = {}) {
    const { ErrorHandler } = this.dependencies;
    const {
      expectedType = null,
      permissions = [],
      allowMissing = false,
      resolveLastSymlink = true,
    } = options;
    const currentUser = this.dependencies.UserManager.getCurrentUser().name;

    const resolvedPath = this.getAbsolutePath(pathArg);
    const node = this.getNodeByPath(resolvedPath, { resolveLastSymlink });

    if (!node) {
      if (allowMissing) {
        return ErrorHandler.createSuccess({ node: null, resolvedPath });
      }
      return ErrorHandler.createError(`${pathArg}: No such file or directory`);
    }

    if (expectedType && node.type !== expectedType) {
      if (expectedType === "file") {
        return ErrorHandler.createError(`${pathArg}: Is not a file`);
      }
      if (expectedType === "directory") {
        return ErrorHandler.createError(`${pathArg}: Is not a directory`);
      }
    }

    for (const perm of permissions) {
      if (!this.hasPermission(node, currentUser, perm)) {
        return ErrorHandler.createError(`${pathArg}: Permission denied`);
      }
    }

    return ErrorHandler.createSuccess({ node, resolvedPath });
  }

  /**
   * Calculates the total size of a node, including its children if it's a directory.
   * @param {FileSystemNode} node - The node to calculate the size of.
   * @returns {number} The total size in bytes.
   */
  calculateNodeSize(node) {
    if (!node) return 0;
    if (node.type === this.config.FILESYSTEM.DEFAULT_FILE_TYPE)
      return (node.content || "").length;
    if (node.type === this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
      let totalSize = 0;
      for (const childName in node.children)
        totalSize += this.calculateNodeSize(node.children[childName]);
      return totalSize;
    }
    return 0;
  }

  /**
   * Updates the modification timestamp of a node and its parents.
   * @private
   * @param {string} nodePath - The path of the node to update.
   * @param {string} nowISO - The current timestamp.
   */
  _updateNodeAndParentMtime(nodePath, nowISO) {
    if (!nodePath || !nowISO) return;
    const node = this.getNodeByPath(nodePath);
    if (node) node.mtime = nowISO;
    if (nodePath !== this.config.FILESYSTEM.ROOT_PATH) {
      const parentPath =
          nodePath.substring(
              0,
              nodePath.lastIndexOf(this.config.FILESYSTEM.PATH_SEPARATOR)
          ) || this.config.FILESYSTEM.ROOT_PATH;
      const parentNode = this.getNodeByPath(parentPath);
      if (
          parentNode &&
          parentNode.type === this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      )
        parentNode.mtime = nowISO;
    }
  }

  /**
   * Creates a directory path recursively if it doesn't exist.
   * @param {string} fullPath - The full path to a file or directory.
   * @returns {object} A success object containing the final parent node, or an error.
   */
  createParentDirectoriesIfNeeded(fullPath) {
    const { ErrorHandler } = this.dependencies;
    const currentUserForCPDIF = this.dependencies.UserManager.getCurrentUser().name;
    const nowISO = new Date().toISOString();
    if (fullPath === this.config.FILESYSTEM.ROOT_PATH) {
      return ErrorHandler.createError(
          "Cannot create directory structure for root."
      );
    }
    const lastSlashIndex = fullPath.lastIndexOf(
        this.config.FILESYSTEM.PATH_SEPARATOR
    );
    const parentPathForSegments =
        lastSlashIndex === 0
            ? this.config.FILESYSTEM.ROOT_PATH
            : fullPath.substring(0, lastSlashIndex);
    if (parentPathForSegments === this.config.FILESYSTEM.ROOT_PATH) {
      return ErrorHandler.createSuccess(
          this.fsData[this.config.FILESYSTEM.ROOT_PATH]
      );
    }
    const segmentsToCreate = parentPathForSegments
        .substring(1)
        .split(this.config.FILESYSTEM.PATH_SEPARATOR)
        .filter((s) => s);
    let currentParentNode = this.fsData[this.config.FILESYSTEM.ROOT_PATH];
    let currentProcessedPath = this.config.FILESYSTEM.ROOT_PATH;
    if (
        !currentParentNode ||
        typeof currentParentNode.owner === "undefined" ||
        typeof currentParentNode.mode === "undefined"
    ) {
      return ErrorHandler.createError(
          "Internal error: Root FS node is malformed."
      );
    }
    for (const segment of segmentsToCreate) {
      if (
          !currentParentNode.children ||
          typeof currentParentNode.children !== "object"
      ) {
        const errorMsg = `Internal error: currentParentNode.children is not an object at path "${currentProcessedPath}" for segment "${segment}". FS may be corrupted.`;
        console.error(errorMsg, currentParentNode);
        return ErrorHandler.createError(errorMsg);
      }
      if (!currentParentNode.children[segment]) {
        if (
            !this.hasPermission(currentParentNode, currentUserForCPDIF, "write")
        ) {
          const errorMsg = `Cannot create directory '${segment}' in '${currentProcessedPath}'${this.config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
          return ErrorHandler.createError(errorMsg);
        }
        currentParentNode.children[segment] = {
          type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
          children: {},
          owner: currentUserForCPDIF,
          group: currentUserForCPDIF,
          mode: this.config.FILESYSTEM.DEFAULT_DIR_MODE,
          mtime: nowISO,
        };
        currentParentNode.mtime = nowISO;
      } else if (
          currentParentNode.children[segment].type !==
          this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        const errorMsg = `Path component '${this.getAbsolutePath(
            segment,
            currentProcessedPath
        )}' is not a directory.`;
        return ErrorHandler.createError(errorMsg);
      }
      currentParentNode = currentParentNode.children[segment];
      currentProcessedPath = this.getAbsolutePath(
          segment,
          currentProcessedPath
      );
      if (
          !currentParentNode ||
          typeof currentParentNode.owner === "undefined" ||
          typeof currentParentNode.mode === "undefined"
      )
        return ErrorHandler.createError(
            `Internal error: Node for "${currentProcessedPath}" became malformed during parent creation.`
        );
    }
    return ErrorHandler.createSuccess(currentParentNode);
  }

  /**
   * Checks if a user has a specific permission on a given node.
   * This is like checking your membership card before letting you into the treehouse.
   * @param {FileSystemNode} node - The node to check permissions on.
   * @param {string} username - The name of the user.
   * @param {('read'|'write'|'execute')} permissionType - The permission type to check.
   * @returns {boolean} True if the user has permission, false otherwise.
   */
  hasPermission(node, username, permissionType) {
    if (username === "root") {
      return true;
    }

    if (!node) {
      return false;
    }

    const permissionMap = {
      read: 4,
      write: 2,
      execute: 1,
    };

    const requiredPerm = permissionMap[permissionType];
    if (!requiredPerm) {
      console.error(`Unknown permissionType requested: ${permissionType}`);
      return false;
    }

    const mode = node.mode || 0;
    const ownerPerms = (mode >> 6) & 7;
    const groupPerms = (mode >> 3) & 7;
    const otherPerms = mode & 7;

    if (node.owner === username) {
      return (ownerPerms & requiredPerm) === requiredPerm;
    }

    const userGroups = this.dependencies.GroupManager.getGroupsForUser(username);
    if (userGroups.includes(node.group)) {
      return (groupPerms & requiredPerm) === requiredPerm;
    }

    return (otherPerms & requiredPerm) === requiredPerm;
  }

  /**
   * Formats a node's permission mode into a human-readable string (e.g., 'drwxr-xr-x').
   * @param {FileSystemNode} node - The node to format.
   * @returns {string} The formatted permission string.
   */
  formatModeToString(node) {
    if (!node || typeof node.mode !== "number") {
      return "----------";
    }
    const typeChar =
        node.type === this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? "d" : "-";

    const ownerPerms = (node.mode >> 6) & 7;
    const groupPerms = (node.mode >> 3) & 7;
    const otherPerms = node.mode & 7;

    const perm_str = (permValue) => {
      let str = "";
      let p_copy = permValue;

      if (p_copy >= 4) {
        str += "r";
        p_copy -= 4;
      } else {
        str += "-";
      }
      if (p_copy >= 2) {
        str += "w";
        p_copy -= 2;
      } else {
        str += "-";
      }
      if (p_copy >= 1) {
        str += "x";
      } else {
        str += "-";
      }
      return str;
    };

    return (
        typeChar +
        perm_str(ownerPerms) +
        perm_str(groupPerms) +
        perm_str(otherPerms)
    );
  }

  /**
   * Recursively deletes a node and all its children.
   * This is like cleaning out your backpack, but on a digital scale.
   * @param {string} path - The path of the node to delete.
   * @param {object} options - Options for the deletion, including force and user context.
   * @returns {Promise<object>} A promise that resolves to a success or error object.
   */
  async deleteNodeRecursive(path, options = {}) {
    const { ErrorHandler } = this.dependencies;
    const { force = false, currentUser } = options;
    const pathValidationResult = this.validatePath(path, {
      disallowRoot: true,
      resolveLastSymlink: false
    });
    if (!pathValidationResult.success) {
      if (force && !pathValidationResult.data?.node) {
        return ErrorHandler.createSuccess({ messages: [] });
      }
      return ErrorHandler.createError(pathValidationResult.error);
    }
    const { node, resolvedPath } = pathValidationResult.data;
    const parentPath =
        resolvedPath.substring(
            0,
            resolvedPath.lastIndexOf(this.config.FILESYSTEM.PATH_SEPARATOR)
        ) || this.config.FILESYSTEM.ROOT_PATH;
    const parentNode = this.getNodeByPath(parentPath);
    const itemName = resolvedPath.substring(
        resolvedPath.lastIndexOf(this.config.FILESYSTEM.PATH_SEPARATOR) + 1
    );
    const nowISO = new Date().toISOString();
    let messages = [];
    let anyChangeMade = false;
    if (!parentNode || !this.hasPermission(parentNode, currentUser, "write")) {
      const permError = `cannot remove '${path}'${this.config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
      return ErrorHandler.createError(permError);
    }

    if (node.type === this.config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
      delete parentNode.children[itemName];
      parentNode.mtime = nowISO;
      anyChangeMade = true;
      return ErrorHandler.createSuccess({ messages, anyChangeMade });
    }

    if (node.type === this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
      if (node.children && typeof node.children === "object") {
        const childrenNames = Object.keys(node.children);
        for (const childName of childrenNames) {
          const childPath = this.getAbsolutePath(childName, resolvedPath);
          const result = await this.deleteNodeRecursive(childPath, options);
          if (!result.success) {
            messages.push(result.error);
            return ErrorHandler.createError(messages.join('\n'));
          }
        }
      } else {
        console.warn(
            `FileSystemManager: Directory node at '${path}' is missing or has an invalid 'children' property.`,
            node
        );
      }
    }

    delete parentNode.children[itemName];
    parentNode.mtime = nowISO;
    anyChangeMade = true;
    return ErrorHandler.createSuccess({ messages, anyChangeMade });
  }

  /**
   * Creates a new file node object with default properties.
   * @private
   * @param {string} name - The name of the new file.
   * @param {string} content - The content of the new file.
   * @param {string} owner - The owner of the file.
   * @param {string} group - The group of the file.
   * @param {number|null} [mode=null] - The permission mode. Defaults to `config.FILESYSTEM.DEFAULT_FILE_MODE`.
   * @returns {FileSystemNode} The new file node.
   */
  _createNewFileNode(name, content, owner, group, mode = null) {
    const nowISO = new Date().toISOString();
    return {
      type: this.config.FILESYSTEM.DEFAULT_FILE_TYPE,
      content: content || "",
      owner: owner,
      group: group,
      mode: mode !== null ? mode : this.config.FILESYSTEM.DEFAULT_FILE_MODE,
      mtime: nowISO,
    };
  }

  /**
   * Calculates the total size of the filesystem.
   * @private
   * @returns {number} The total size in bytes.
   */
  _calculateTotalSize() {
    if (!this.fsData || !this.fsData[this.config.FILESYSTEM.ROOT_PATH]) return 0;
    return this.calculateNodeSize(this.fsData[this.config.FILESYSTEM.ROOT_PATH]);
  }

  /**
   * Checks if an operation would exceed the disk quota.
   * @private
   * @param {number} changeInBytes - The change in size from the operation.
   * @returns {boolean} True if the quota would be exceeded.
   */
  _willOperationExceedQuota(changeInBytes) {
    const currentSize = this._calculateTotalSize();
    return currentSize + changeInBytes > this.config.FILESYSTEM.MAX_VFS_SIZE;
  }

  /**
   * Creates a new empty directory node with default properties.
   * @private
   * @param {string} owner - The owner of the directory.
   * @param {string} group - The group of the directory.
   * @param {number|null} [mode=null] - The permission mode. Defaults to `config.FILESYSTEM.DEFAULT_DIR_MODE`.
   * @returns {FileSystemNode} The new directory node.
   */
  _createNewDirectoryNode(owner, group, mode = null) {
    const nowISO = new Date().toISOString();
    return {
      type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
      children: {},
      owner: owner,
      group: group,
      mode: mode !== null ? mode : this.config.FILESYSTEM.DEFAULT_DIR_MODE,
      mtime: nowISO,
    };
  }

  /**
   * Creates or updates a file at a specified path.
   * This is the core workhorse function for file writing.
   * @param {string} absolutePath - The absolute path of the file.
   * @param {string} content - The content to write to the file.
   * @param {object} context - The context of the operation, including user and group info.
   * @returns {Promise<object>} A promise that resolves to a success or error object.
   */
  async createOrUpdateFile(absolutePath, content, context) {
    const { ErrorHandler } = this.dependencies;
    const {
      currentUser,
      primaryGroup,
      isDirectory = false,
    } = context;
    const nowISO = new Date().toISOString();

    if (isDirectory) {
      const parentDirResult = this.createParentDirectoriesIfNeeded(absolutePath);
      if (!parentDirResult.success) {
        return parentDirResult;
      }
      const parentNode = parentDirResult.data;
      if (!this.hasPermission(parentNode, currentUser, "write")) {
        return ErrorHandler.createError(`Cannot create directory in parent: Permission denied`);
      }
      const dirName = absolutePath.substring(absolutePath.lastIndexOf("/") + 1);
      if (parentNode.children && !parentNode.children[dirName]) {
        parentNode.children[dirName] = this._createNewDirectoryNode(currentUser, primaryGroup);
        parentNode.mtime = nowISO;
      }
      return ErrorHandler.createSuccess();
    }

    const existingNode = this.getNodeByPath(absolutePath);
    const changeInBytes = (content || "").length - (existingNode?.content?.length || 0);

    if (this._willOperationExceedQuota(changeInBytes)) {
      return ErrorHandler.createError(
          `Disk quota exceeded. Cannot write ${content.length} bytes.`
      );
    }

    if (existingNode) {
      if (existingNode.type !== this.config.FILESYSTEM.DEFAULT_FILE_TYPE) {
        return ErrorHandler.createError(
            `Cannot overwrite non-file '${absolutePath}'`
        );
      }
      if (!this.hasPermission(existingNode, currentUser, "write")) {
        return ErrorHandler.createError(`'${absolutePath}': Permission denied`);
      }
      existingNode.content = content;
      existingNode.mtime = nowISO;
    } else {
      const parentDirResult =
          this.createParentDirectoriesIfNeeded(absolutePath);
      if (!parentDirResult.success) {
        return parentDirResult;
      }
      const parentNode = parentDirResult.data;

      if (!parentNode) {
        return ErrorHandler.createError(
            `Could not find or create parent directory for '${absolutePath}'.`
        );
      }

      if (!this.hasPermission(parentNode, currentUser, "write")) {
        return ErrorHandler.createError(
            `Cannot create file in parent directory: Permission denied`
        );
      }

      if (!parentNode.children || typeof parentNode.children !== "object") {
        console.error(
            `FileSystemManager: Corrupted directory node at parent of '${absolutePath}'. Missing 'children' property. Restoring it.`,
            parentNode
        );
        parentNode.children = {};
      }

      const fileName = absolutePath.substring(
          absolutePath.lastIndexOf(this.config.FILESYSTEM.PATH_SEPARATOR) + 1
      );
      parentNode.children[fileName] = this._createNewFileNode(
          fileName,
          content,
          currentUser,
          primaryGroup
      );
      parentNode.mtime = nowISO;
    }

    return ErrorHandler.createSuccess();
  }

  /**
   * Checks if a user has ownership or root privileges to modify a node.
   * @param {FileSystemNode} node - The node to check.
   * @param {string} username - The name of the user.
   * @returns {boolean} True if the user can modify the node.
   */
  canUserModifyNode(node, username) {
    return username === "root" || node.owner === username;
  }

  /**
   * Prepares a plan for a file operation (move or copy) involving multiple sources and a single destination.
   * This is like planning a play before the actors even get on stage.
   * @param {string[]} sourcePathArgs - An array of source paths.
   * @param {string} destPathArg - The destination path.
   * @param {object} options - Options for the operation (isCopy, isMove).
   * @returns {Promise<object>} A promise that resolves to a plan of operations or an error object.
   */
  async prepareFileOperation(sourcePathArgs, destPathArg, options = {}) {
    const { ErrorHandler } = this.dependencies;
    const { isCopy = false, isMove = false } = options;

    const destValidationResult = this.validatePath(destPathArg, {
      allowMissing: true,
    });
    if (
        !destValidationResult.success &&
        destValidationResult.data?.node === undefined
    ) {
      return ErrorHandler.createError(
          `target '${destPathArg}': ${destValidationResult.error}`
      );
    }
    const isDestADirectory =
        destValidationResult.data.node &&
        destValidationResult.data.node.type === "directory";

    if (sourcePathArgs.length > 1 && !isDestADirectory) {
      return ErrorHandler.createError(
          `target '${destPathArg}' is not a directory`
      );
    }

    const operationsPlan = [];
    for (const sourcePath of sourcePathArgs) {
      let sourceValidationResult;
      if (isCopy) {
        sourceValidationResult = this.validatePath(sourcePath, {
          permissions: ["read"],
        });
      } else {
        sourceValidationResult = this.validatePath(sourcePath);
        if (sourceValidationResult.success) {
          const sourceParentPath =
              sourceValidationResult.data.resolvedPath.substring(
                  0,
                  sourceValidationResult.data.resolvedPath.lastIndexOf("/")
              ) || "/";
          const parentValidation = this.validatePath(sourceParentPath, {
            permissions: ["write"],
          });
          if (!parentValidation.success) {
            return ErrorHandler.createError(
                `cannot move '${sourcePath}', permission denied in source directory`
            );
          }
        }
      }

      if (!sourceValidationResult.success) {
        return ErrorHandler.createError(
            `${sourcePath}: ${sourceValidationResult.error}`
        );
      }

      const { node: sourceNode, resolvedPath: sourceAbsPath } =
          sourceValidationResult.data;

      let destinationAbsPath;
      let finalName;
      let destinationParentNode;

      if (isDestADirectory) {
        finalName = sourceAbsPath.substring(sourceAbsPath.lastIndexOf("/") + 1);
        destinationAbsPath = this.getAbsolutePath(
            finalName,
            destValidationResult.data.resolvedPath
        );
        destinationParentNode = destValidationResult.data.node;
      } else {
        finalName = destValidationResult.data.resolvedPath.substring(
            destValidationResult.data.resolvedPath.lastIndexOf("/") + 1
        );
        destinationAbsPath = destValidationResult.data.resolvedPath;
        const destParentPath =
            destinationAbsPath.substring(
                0,
                destinationAbsPath.lastIndexOf("/")
            ) || "/";
        const destParentValidation = this.validatePath(destParentPath, {
          expectedType: "directory",
          permissions: ["write"],
        });
        if (!destParentValidation.success) {
          return ErrorHandler.createError(destParentValidation.error);
        }
        destinationParentNode = destParentValidation.data.node;
      }

      const willOverwrite = !!destinationParentNode.children[finalName];

      if (isDestADirectory) {
        const parentValidation = this.validatePath(
            destValidationResult.data.resolvedPath,
            { permissions: ["write"] }
        );
        if (!parentValidation.success) {
          return ErrorHandler.createError(parentValidation.error);
        }
      }

      if (isMove) {
        if (sourceAbsPath === "/") {
          return ErrorHandler.createError("cannot move root directory");
        }
        if (
            sourceNode.type === "directory" &&
            destinationAbsPath.startsWith(sourceAbsPath + "/")
        ) {
          return ErrorHandler.createError(
              `cannot move '${sourcePath}' to a subdirectory of itself, '${destinationAbsPath}'`
          );
        }
      }

      operationsPlan.push({
        sourceNode,
        sourceAbsPath,
        destinationAbsPath,
        destinationParentNode,
        finalName,
        willOverwrite,
      });
    }

    return ErrorHandler.createSuccess(operationsPlan);
  }
}