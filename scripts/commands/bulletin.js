/**
 * @file /scripts/commands/bulletin.js
 * @description The 'bulletin' command, a system-wide message board for persistent, timestamped announcements.
 * It handles posting, listing, and clearing messages.
 */

/**
 * Represents the 'bulletin' command for managing the system-wide message board.
 * @class BulletinCommand
 * @extends Command
 */
window.BulletinCommand = class BulletinCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "bulletin",
            description: "Manages the system-wide bulletin board.",
            helpText: `Usage: bulletin <sub-command> [options]
      Manages the system-wide, persistent message board.

      SUB-COMMANDS:
        post "<message>"   Appends a new, timestamped message to the board.
        list               Displays all messages on the board.
        clear              Clears all messages from the board (root only).

      EXAMPLES:
        bulletin post "The annual Pawnee Harvest Festival planning meeting is Tuesday at 8."
        bulletin list
        bulletin list | grep "meeting"
        sudo bulletin clear`,
        });
    }

    /**
     * Main logic for the 'bulletin' command. Acts as a router for the sub-commands.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;
        const subCommand = args[0];

        if (!subCommand) {
            return ErrorHandler.createError("bulletin: missing sub-command. Use 'post', 'list', or 'clear'.");
        }

        switch (subCommand.toLowerCase()) {
            case "post":
                return this._handlePost(context);
            case "list":
                return this._handleList(context);
            case "clear":
                return this._handleClear(context);
            default:
                return ErrorHandler.createError(`bulletin: unknown sub-command '${subCommand}'.`);
        }
    }

    /**
     * Gets the absolute path to the bulletin board file.
     * @param {object} dependencies - The system dependencies.
     * @returns {string} The absolute path to '/var/log/bulletin.md'.
     * @private
     */
    _getBulletinPath(dependencies) {
        const { FileSystemManager } = dependencies;
        return FileSystemManager.getAbsolutePath("/var/log/bulletin.md");
    }

    /**
     * Ensures that the bulletin board file and its parent directories exist, creating them if necessary.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A success object if the file exists or was created, otherwise an error object.
     * @private
     */
    async _ensureBulletinExists(context) {
        const { currentUser, dependencies } = context;
        const { FileSystemManager, UserManager } = dependencies;
        const bulletinPath = this._getBulletinPath(dependencies);

        const logDirPath = "/var/log";
        const logDirNode = FileSystemManager.getNodeByPath(logDirPath);
        if (!logDirNode) {
            const mkdirResult = await dependencies.CommandExecutor.processSingleCommand(
                `mkdir -p ${logDirPath}`,
                { isInteractive: false }
            );
            if (!mkdirResult.success) {
                return dependencies.ErrorHandler.createError("bulletin: could not create essential /var/log directory.");
            }
        }

        const bulletinNode = FileSystemManager.getNodeByPath(bulletinPath);
        if (!bulletinNode) {
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const createResult = await FileSystemManager.createOrUpdateFile(
                bulletinPath,
                "# OopisOS Town Bulletin\\n",
                { currentUser, primaryGroup }
            );
            if (!createResult.success) {
                return dependencies.ErrorHandler.createError(`bulletin: could not create the bulletin board file at '${bulletinPath}'.`);
            }
            await FileSystemManager.save();
        }
        return dependencies.ErrorHandler.createSuccess();
    }

    /**
     * Handles the 'post' sub-command to add a new message to the bulletin board.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     * @private
     */
    async _handlePost(context) {
        const { args, currentUser, dependencies } = context;
        const { FileSystemManager, GroupManager, ErrorHandler } = dependencies;
        const message = args.slice(1).join(" ");

        if (!message) {
            return ErrorHandler.createError("bulletin post: requires a message in quotes.");
        }

        const ensureResult = await this._ensureBulletinExists(context);
        if (!ensureResult.success) return ensureResult;

        const bulletinPath = this._getBulletinPath(dependencies);
        const bulletinNode = FileSystemManager.getNodeByPath(bulletinPath);

        const userGroups = GroupManager.getGroupsForUser(currentUser);
        const isTownCrier = userGroups.includes('towncrier');
        const postHeader = isTownCrier ? "Official Announcement" : "Message";

        const timestamp = new Date().toISOString();
        const newEntry = `
---
**Posted by:** ${currentUser} on ${timestamp}
**${postHeader}:**
${message}
`;

        const newContent = (bulletinNode.content || "") + newEntry;
        const saveResult = await FileSystemManager.createOrUpdateFile(bulletinPath, newContent, { currentUser });

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess("Message posted to bulletin.", { stateModified: true });
        } else {
            return ErrorHandler.createError(`bulletin: could not post message: ${saveResult.error}`);
        }
    }

    /**
     * Handles the 'list' sub-command by displaying the contents of the bulletin file.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the 'cat' command execution.
     * @private
     */
    async _handleList(context) {
        const { dependencies } = context;
        const { ErrorHandler } = dependencies;

        const ensureResult = await this._ensureBulletinExists(context);
        if (!ensureResult.success) return ensureResult;

        return await dependencies.CommandExecutor.processSingleCommand(
            `cat ${this._getBulletinPath(dependencies)}`,
            { isInteractive: false }
        );
    }

    /**
     * Handles the 'clear' sub-command to empty the bulletin board. Root access is required.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     * @private
     */
    async _handleClear(context) {
        const { currentUser, dependencies } = context;
        const { FileSystemManager, ErrorHandler } = dependencies;

        if (currentUser !== 'root') {
            return ErrorHandler.createError("bulletin clear: only root can clear the bulletin board.");
        }

        const bulletinPath = this._getBulletinPath(dependencies);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            bulletinPath,
            "# OopisOS Town Bulletin (cleared)\\n",
            { currentUser: 'root', primaryGroup: 'root' }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess("Bulletin board cleared.", { stateModified: true });
        } else {
            return ErrorHandler.createError(`bulletin: could not clear bulletin: ${saveResult.error}`);
        }
    }
};

window.CommandRegistry.register(new BulletinCommand());