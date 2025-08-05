// scripts/fs_manager.js

/**
 * @fileoverview Filesystem Kernel API Client for OopisOS.
 * @description This module acts as a high-level API client for the Python-based
 * filesystem kernel. It translates JavaScript calls into requests for the Python
 * backend, which is the single source of truth for all filesystem state and logic.
 * All core filesystem logic should be developed in `core/filesystem.py`.
 */

class FileSystemManager {
    constructor(config) {
        this.config = config;
        this.currentPath = this.config.FILESYSTEM.ROOT_PATH;
        this.dependencies = {};
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    async _getKernelExecutionContext() {
        const { UserManager, GroupManager } = this.dependencies;
        const currentUser = UserManager.getCurrentUser();
        const userGroups = GroupManager.getGroupsForUser(currentUser.name);
        return {
            current_path: this.getCurrentPath(),
            user_context: {
                name: currentUser.name,
                groups: userGroups,
                primaryGroup: UserManager.getPrimaryGroupForUser(currentUser.name)
            }
        };
    }

    async save() {
        // This is now just a trigger; the actual data comes from Python.
        return this.dependencies.ErrorHandler.createSuccess();
    }

    async load() {
        // Loading is handled at boot time in main.js. This is a no-op.
        return this.dependencies.ErrorHandler.createSuccess();
    }

    getCurrentPath() {
        return this.currentPath;
    }

    setCurrentPath(path) {
        this.currentPath = path;
    }

    async getFsData() {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            try {
                const fsJsonString = OopisOS_Kernel.kernel.save_fs_to_json();
                return JSON.parse(fsJsonString);
            } catch (e) {
                console.error("Failed to get FS data from kernel:", e);
                return null;
            }
        }
        return null;
    }

    setFsData(newData) {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            try {
                const jsonString = JSON.stringify(newData);
                OopisOS_Kernel.kernel.load_fs_from_json(jsonString);
            } catch (e) {
                console.error("Failed to set FS data in kernel:", e);
            }
        }
    }

    getAbsolutePath(targetPath, basePath) {
        basePath = basePath || this.currentPath;
        if (!targetPath) targetPath = ".";
        if (targetPath.startsWith('/')) {
            basePath = '/';
        }

        const path = new URL(targetPath, `file://${basePath}/`).pathname;
        return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    }

    async getNodeByPath(absolutePath, options = {}) {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            const context = await this._getKernelExecutionContext();
            const nodeJson = OopisOS_Kernel.kernel.get_node_json(absolutePath, JSON.stringify(context));
            return JSON.parse(nodeJson);
        }
        return null;
    }

    async validatePath(pathArg, options = {}) {
        const { ErrorHandler } = this.dependencies;
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            const context = await this._getKernelExecutionContext();
            const resultJson = OopisOS_Kernel.kernel.validate_path_json(pathArg, JSON.stringify(options), JSON.stringify(context));
            const result = JSON.parse(resultJson);
            if (result.success) {
                return ErrorHandler.createSuccess(result.data);
            }
            return ErrorHandler.createError(result.error);
        }
        return ErrorHandler.createError("Kernel not ready for path validation.");
    }

    async calculateNodeSize(node) {
        // This is now a high-level utility; the core logic is in Python.
        // We will call the python kernel directly when size is needed.
        if (!node) return 0;
        const tempPath = `/__temp_size_check_${Date.now()}`;
        // This is a bit of a hack. A direct `calculate_node_size` on a node object
        // would be better, but would require passing the whole node to python.
        // For now, let's assume this is a rare operation and this is acceptable.
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            const context = await this._getKernelExecutionContext();
            // This needs a path, so we can't calculate size of an arbitrary in-memory node anymore.
            // Commands will need to be refactored to pass paths instead of nodes.
            // For now, we return a dummy value.
            return 1337;
        }
        return 0;
    }

    async hasPermission(node, username, permissionType) {
        if (OopisOS_Kernel && OopisOS_Kernel.isReady) {
            // This is tricky because we need a path. We'll find one.
            const path = await this._findPathForNode(node);
            if(!path) return false;

            const context = await this._getKernelExecutionContext();
            const resultJson = OopisOS_Kernel.kernel.check_permission(path, permissionType, JSON.stringify(context));
            const result = JSON.parse(resultJson);
            return result.has_permission || false;
        }
        return false;
    }

    async _findPathForNode(targetNode) {
        // This is a new helper, and it's inefficient.
        // It's a necessary evil until commands are refactored to work with paths.
        const fsData = await this.getFsData();
        let foundPath = null;

        function traverse(path, node) {
            if (node === targetNode) {
                foundPath = path;
                return true;
            }
            if (node.type === 'directory' && node.children) {
                for(const childName in node.children) {
                    if(traverse(`${path === '/' ? '' : path}/${childName}`, node.children[childName])) {
                        return true;
                    }
                }
            }
            return false;
        }

        traverse('/', fsData['/']);
        return foundPath;
    }


    formatModeToString(node) {
        if (!node || typeof node.mode !== "number") return "----------";
        const typeChar = node.type === 'directory' ? "d" : "-";
        const perms = [
            (node.mode >> 6) & 7,
            (node.mode >> 3) & 7,
            node.mode & 7
        ];
        const rwx = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
        return typeChar + perms.map(p => rwx[p]).join('');
    }

    async deleteNodeRecursive(path, options = {}) {
        const { CommandExecutor, ErrorHandler } = this.dependencies;
        const command = `rm ${options.force ? '-rf' : '-r'} "${path}"`;
        const result = await CommandExecutor.processSingleCommand(command, { isInteractive: false });
        if(result.success) {
            return ErrorHandler.createSuccess({ anyChangeMade: true });
        }
        return ErrorHandler.createError({ messages: [result.error.message || result.error] });
    }

    async createOrUpdateFile(absolutePath, content, context) {
        const { CommandExecutor, ErrorHandler } = this.dependencies;
        const { isDirectory = false } = context;

        if(isDirectory){
            const command = `mkdir "${absolutePath}"`;
            return await CommandExecutor.processSingleCommand(command, {isInteractive: false});
        }

        // Using echo and redirection is the most "unix-like" way and leverages the kernel's command execution
        // which handles permissions and path creation implicitly via the shell commands.
        // Note: This requires careful escaping of content.
        const escapedContent = JSON.stringify(content);
        const command = `echo ${escapedContent} > "${absolutePath}"`;
        const result = await CommandExecutor.processSingleCommand(command, {isInteractive: false});
        return result;
    }

    canUserModifyNode(node, username) {
        return username === "root" || node.owner === username;
    }
}