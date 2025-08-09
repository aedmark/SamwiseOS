// scripts/fs_manager.js

/**
 * @fileoverview This file has been refactored as part of the "Samwise" project.
 * It is now a high-level API client for the Python filesystem kernel.
 * All core filesystem logic and state management are now handled by `core/filesystem.py`.
 * All future development of core FS logic should be done in the Python files.
 * @class FileSystemManager
 * @classdesc An API client for the OopisOS Python Filesystem Kernel.
 */

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
class FileSystemManager {
    /**
     * @constructor
     * @param {object} config - The global configuration object.
     */
    constructor(config) {
        this.config = config;
        /** @deprecated The in-memory fsData is deprecated. State is managed by the Python kernel. */
        this.fsData = {};
        this.currentPath = this.config.FILESYSTEM.ROOT_PATH;
        this.dependencies = {};
        this.storageHAL = null;
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
        this.userManager = dependencies.UserManager;
        this.groupManager = dependencies.GroupManager;
        this.storageHAL = dependencies.StorageHAL;
    }

    _createKernelContext() {
        // This helper ensures the kernel gets the right user context for permission checks.
        // It duplicates some logic from bridge.js, a small price for security and order!
        const { UserManager, GroupManager, StorageManager, Config } = this.dependencies;
        const user = UserManager.getCurrentUser();
        return { name: user.name, group: UserManager.getPrimaryGroupForUser(user.name) };
    }

    /**
     * Initializes a default filesystem structure in-memory for the first boot sequence.
     * This structure is then sent to the Python kernel to become the initial state.
     */
    async initialize(guestUsername) {
        // This function is now only for initial, first-boot setup.
        const nowISO = new Date().toISOString();
        this.fsData = {
            [this.config.FILESYSTEM.ROOT_PATH]: {
                type: this.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                children: {
                    home: { type: "directory", children: {}, owner: "root", group: "root", mode: 0o755, mtime: nowISO },
                    etc: { type: "directory", children: {
                            'sudoers': { type: "file", content: "# /etc/sudoers\n#\n# This file MUST be edited with the 'visudo' command as root.\n\nroot ALL=(ALL) ALL\n%root ALL=(ALL) ALL\n", owner: 'root', group: 'root', mode: 0o440, mtime: nowISO },
                            'oopis.conf': { type: "file", content: "# OopisOS System Configuration File\n", owner: 'root', group: 'root', mode: 0o644, mtime: nowISO }
                        }, owner: "root", group: "root", mode: 0o755, mtime: nowISO },
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

    async createUserHomeDirectory(username) {
        // This now only modifies the initial JS object before it's sent to Python.
        if (!this.fsData["/"]?.children?.home) {
            console.error("Cannot create user home directory, /home does not exist.");
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

    async save() {
        const { ErrorHandler } = this.dependencies;
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            try {
                const fsJsonString = OopisOS_Kernel.kernel.save_fs_to_json();
                const saveData = JSON.parse(fsJsonString);
                const success = await this.storageHAL.save(saveData);
                if (success) return ErrorHandler.createSuccess();
                return ErrorHandler.createError("OopisOs failed to save the file system via kernel.");
            } catch (e) {
                console.error("Error during Python-JS save operation:", e);
                return ErrorHandler.createError("Failed to serialize or save Python filesystem state.");
            }
        }
        return ErrorHandler.createError("Filesystem save failed: Python kernel is not ready.");
    }

    async load() {
        // This method's role is reduced. The authoritative load happens in main.js.
        return this.dependencies.ErrorHandler.createSuccess();
    }

    async clearAllFS() {
        const success = await this.storageHAL.clear();
        if (success) return this.dependencies.ErrorHandler.createSuccess();
        return this.dependencies.ErrorHandler.createError("Could not clear all user file systems.");
    }

    getCurrentPath() {
        return this.currentPath;
    }

    setCurrentPath(path) {
        this.currentPath = path;
    }

    getFsData() {
        // Refactored to fetch from Python for legacy support (e.g., backup command)
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            // Let's use the new syscall for this read-only operation, too, for consistency!
            const resultJson = OopisOS_Kernel.syscall("filesystem", "save_state_to_json");
            const result = JSON.parse(resultJson);
            if (result.success) {
                return JSON.parse(result.data);
            }
            // Fallback in case of error
            console.error("Failed to get FS data from kernel:", result.error);
            return this.fsData;
        }
        console.warn("getFsData called before kernel was ready. Returning potentially stale JS data.");
        return this.fsData;
    }

    setFsData(newData) {
        // This is now primarily for restoring backups. The data will be sent to Python.
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            // Use the new, unified syscall to set the filesystem state!
            OopisOS_Kernel.syscall("filesystem", "load_state_from_json", [JSON.stringify(newData)]);
        }
        this.fsData = newData; // Keep a JS copy for safety until full transition
    }

    getAbsolutePath(targetPath, basePath) {
        basePath = basePath || this.currentPath;
        if (!targetPath) targetPath = ".";
        let path = targetPath.startsWith('/') ? targetPath : (basePath === '/' ? '/' : basePath + '/') + targetPath;
        const segments = path.split('/').filter(Boolean);
        const resolved = [];
        for (const segment of segments) {
            if (segment === '.') continue;
            if (segment === '..') {
                resolved.pop();
            } else {
                resolved.push(segment);
            }
        }
        return '/' + resolved.join('/');
    }

    async getNodeByPath(absolutePath) {
        if (!OopisOS_Kernel.isReady) return null;
        try {
            // Use the new, unified syscall. No context needed for this call.
            const resultJson = OopisOS_Kernel.syscall("filesystem", "get_node", [absolutePath]);
            const result = JSON.parse(resultJson);
            return result.success ? result.data : null;
        } catch (e) {
            console.error(`JS->getNodeByPath error: ${e}`);
            return null;
        }
    }

    async validatePath(pathArg, options = {}) {
        const { ErrorHandler } = this.dependencies;
        if (!OopisOS_Kernel.isReady) {
            return ErrorHandler.createError("Filesystem kernel not ready.");
        }
        try {
            // Use the new, unified syscall and provide the necessary user context.
            const context = this._createKernelContext();
            const optionsJson = JSON.stringify(options);
            const resultJson = OopisOS_Kernel.syscall("filesystem", "validate_path", [pathArg, context, optionsJson]);
            const result = JSON.parse(resultJson);
            if (result.success) {
                return ErrorHandler.createSuccess({ node: result.node, resolvedPath: result.resolvedPath });
            } else {
                return ErrorHandler.createError(result.error);
            }
        } catch (e) {
            return ErrorHandler.createError(`Path validation failed: ${e.message}`);
        }
    }

    /** @deprecated This function is deprecated. Commands should be refactored to use a path-based kernel call. */
    async calculateNodeSize(node) {
        console.warn("calculateNodeSize on JS node is deprecated. Refactor the calling command to use a path-based kernel call.");
        if (!node) return 0;
        // This is a rough estimation based on JS object, not the source of truth.
        return JSON.stringify(node).length;
    }

    /** @deprecated This function is deprecated. Commands should use validatePath with the permissions option. */
    async hasPermission(node, username, permissionType) {
        console.warn("hasPermission on JS node is deprecated. Refactor the calling command to use validatePath with a permissions check.");
        // We return true as a fallback to prevent breaking old code, but this is not secure.
        return true;
    }


    formatModeToString(node) {
        if (!node || typeof node.mode !== "number") return "----------";
        const typeChar = node.type === "directory" ? "d" : "-";
        const perms = [
            (node.mode >> 6) & 7,
            (node.mode >> 3) & 7,
            node.mode & 7,
        ];
        const rwx = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
        return typeChar + perms.map(p => rwx[p]).join("");
    }

    async deleteNodeRecursive(path, options = {}) {
        const { CommandExecutor, ErrorHandler } = this.dependencies;
        const { force = false } = options;
        const command = `rm ${force ? '-rf' : '-r'} "${path}"`;
        const result = await CommandExecutor.processSingleCommand(command, { isInteractive: false });
        if (result.success) return ErrorHandler.createSuccess({ anyChangeMade: true });
        return ErrorHandler.createError({ messages: [result.error] });
    }

    async createOrUpdateFile(absolutePath, content, context) {
        const { ErrorHandler } = this.dependencies;
        const { isDirectory = false } = context;

        if (!OopisOS_Kernel.isReady) {
            return ErrorHandler.createError("Filesystem kernel not ready for write operation.");
        }

        try {
            const kernelContext = this._createKernelContext();
            let resultJson;

            if (isDirectory) {
                resultJson = OopisOS_Kernel.createDirectory(absolutePath, kernelContext);
            } else {
                resultJson = OopisOS_Kernel.writeFile(absolutePath, content, kernelContext);
            }

            const result = JSON.parse(resultJson);
            if (result.success) {
                return ErrorHandler.createSuccess();
            } else {
                return ErrorHandler.createError(result.error || "An unknown kernel error occurred.");
            }
        } catch (e) {
            return ErrorHandler.createError(`File operation failed: ${e.message}`);
        }
    }

    canUserModifyNode(node, username) {
        return username === "root" || node.owner === username;
    }

    async prepareFileOperation(sourcePathArgs, destPathArg, options = {}) {
        const { ErrorHandler } = this.dependencies;
        const { isCopy = false, isMove = false } = options;

        const destValidationResult = await this.validatePath(destPathArg, { allowMissing: true });
        if (!destValidationResult.success) {
            return ErrorHandler.createError(`target '${destPathArg}': ${destValidationResult.error}`);
        }
        const isDestADirectory = destValidationResult.data.node && destValidationResult.data.node.type === "directory";

        if (sourcePathArgs.length > 1 && !isDestADirectory) {
            return ErrorHandler.createError(`target '${destPathArg}' is not a directory`);
        }

        const operationsPlan = [];
        for (const sourcePath of sourcePathArgs) {
            let sourceValidationResult = await this.validatePath(sourcePath, isCopy ? { permissions: ["read"] } : {});
            if (!sourceValidationResult.success) {
                return ErrorHandler.createError(`${sourcePath}: ${sourceValidationResult.error}`);
            }

            const { node: sourceNode, resolvedPath: sourceAbsPath } = sourceValidationResult.data;
            let destinationAbsPath;
            let finalName;
            let destinationParentNode;

            if (isDestADirectory) {
                finalName = sourceAbsPath.substring(sourceAbsPath.lastIndexOf("/") + 1);
                destinationAbsPath = this.getAbsolutePath(finalName, destValidationResult.data.resolvedPath);
                destinationParentNode = destValidationResult.data.node;
            } else {
                finalName = destValidationResult.data.resolvedPath.substring(destValidationResult.data.resolvedPath.lastIndexOf("/") + 1);
                destinationAbsPath = destValidationResult.data.resolvedPath;
                const destParentPath = destinationAbsPath.substring(0, destinationAbsPath.lastIndexOf("/")) || "/";
                const destParentValidation = await this.validatePath(destParentPath, { expectedType: "directory", permissions: ["write"] });
                if (!destParentValidation.success) {
                    return ErrorHandler.createError(destParentValidation.error);
                }
                destinationParentNode = destParentValidation.data.node;
            }

            const willOverwrite = !!(await this.getNodeByPath(destinationAbsPath));

            if (isMove && sourceAbsPath === "/") {
                return ErrorHandler.createError("cannot move root directory");
            }
            if (isMove && sourceNode.type === "directory" && destinationAbsPath.startsWith(sourceAbsPath + "/")) {
                return ErrorHandler.createError(`cannot move '${sourcePath}' to a subdirectory of itself, '${destinationAbsPath}'`);
            }

            operationsPlan.push({ sourceNode, sourceAbsPath, destinationAbsPath, destinationParentNode, finalName, willOverwrite });
        }

        return ErrorHandler.createSuccess(operationsPlan);
    }
}