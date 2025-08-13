// gem/scripts/audit_manager.js

/**
 * @fileoverview Manages the system audit log, providing a centralized service
 * for logging critical security and administrative events.
 * @class AuditManager
 */
class AuditManager {
    constructor() {
        this.dependencies = {};
        this.LOG_PATH = "/var/log/audit.log";
        this.logQueue = [];
        this.isProcessing = false;
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    /**
     * The primary public method for logging an event.
     * It queues the log entry and processes it asynchronously.
     * @param {string} actor - The user performing the action (e.g., 'root', 'Guest').
     * @param {string} action - The name of the action (e.g., 'login', 'sudo_exec').
     * @param {string} details - A description of the event.
     */
    log(actor, action, details) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} | USER: ${actor} | ACTION: ${action} | DETAILS: ${details}\n`;
        this.logQueue.push(logEntry);
        this._processQueue();
    }

    /**
     * Processes the log queue sequentially, writing entries to the audit log file.
     * @private
     */
    async _processQueue() {
        if (this.isProcessing || this.logQueue.length === 0) {
            return;
        }
        this.isProcessing = true;

        const { FileSystemManager } = this.dependencies;
        const entry = this.logQueue.shift();

        try {
            const logNode = await FileSystemManager.getNodeByPath(this.LOG_PATH);

            if (!logNode) {
                // Create the log file if it doesn't exist. This now calls Python which handles the save.
                const createResult = await FileSystemManager.createOrUpdateFile(
                    this.LOG_PATH,
                    entry,
                    { currentUser: 'root', primaryGroup: 'root' }
                );
                if (!createResult.success) throw new Error(createResult.error);
                // Set correct permissions after creation via a direct command, as this is a root-level operation.
                await this.dependencies.CommandExecutor.processSingleCommand(`chmod 640 ${this.LOG_PATH}`, { isInteractive: false });

            } else {
                // Append to the existing log file. This also calls Python which handles the save.
                const newContent = (logNode.content || "") + entry;
                const updateResult = await FileSystemManager.createOrUpdateFile(
                    this.LOG_PATH,
                    newContent,
                    { currentUser: 'root', primaryGroup: 'root' }
                );
                if (!updateResult.success) throw new Error(updateResult.error);
            }
        } catch (e) {
            console.error("AuditDaemon: Failed to write to log.", e);
            // Re-queue the entry if saving fails.
            this.logQueue.unshift(entry);
        } finally {
            this.isProcessing = false;
            // If there are more items, process them.
            if (this.logQueue.length > 0) {
                this._processQueue();
            }
        }
    }
}