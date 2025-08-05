// oos-dev/scripts/commands/fsck.js

/**
 * @fileoverview This file defines the 'fsck' command, a utility for checking
 * and optionally repairing the integrity of the OopisOS virtual file system.
 * @module commands/fsck
 */

/**
 * Represents the 'fsck' (file system check) command.
 * @class FsckCommand
 * @extends Command
 */
window.FsckCommand = class FsckCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "fsck",
            description: "Checks and optionally repairs filesystem integrity.",
            helpText: `Usage: fsck [--repair] [--yes] [path]
      Checks the integrity of the OopisOS filesystem.

      DESCRIPTION
      The fsck (file system check) utility scans the filesystem starting
      from the given path (or the root if no path is provided) to find
      and report on inconsistencies.

      It verifies:
      - Structural Integrity: Ensures all files/directories are properly formed.
      - Ownership: Checks for valid user and group ownership.
      - User Homes: Confirms every user has a valid home directory.
      - Symbolic Links: Identifies broken or dangling symbolic links.
      - Permission Sanity: Checks for common permission vulnerabilities.

      OPTIONS
      --repair
            After scanning, prompts the user interactively to fix any
            issues that were found.
      -y, --yes
            Automatically apply safe, default repairs without prompting.
            This will:
            - Delete dangling symlinks and malformed nodes.
            - Reassign orphaned files/directories to 'root'.
            - Create missing home directories.
            - Correct home directory ownership.
            - Apply safe permission fixes (e.g., removing world-writable
              permissions on sensitive files).

      WARNING: Running with --repair can result in data loss if used
      improperly. It is recommended to run without this flag first to
      review the potential changes.`,
            flagDefinitions: [
                { name: "repair", long: "--repair" },
                { name: "yes", short: "-y", long: "--yes" }
            ],
            argValidation: {
                max: 1,
            },
        });
    }

    /**
     * Executes the core logic of the 'fsck' command.
     * This function performs a multi-phase audit of the filesystem, checking for
     * structural integrity, ownership issues, and home directory consistency.
     * If the '--repair' flag is used, it enters an interactive mode to fix
     * any detected issues.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, flags, dependencies, options } = context;
        const { FileSystemManager, UserManager, GroupManager, StorageManager, OutputManager, ModalManager, ErrorHandler, Config } = dependencies;

        const startPath = args[0] || '/';
        const repairMode = flags.repair || flags.yes;
        const autoYes = flags.yes || false;

        const pathValidation = FileSystemManager.validatePath(startPath, { expectedType: 'directory' });
        if (!pathValidation.success) {
            return ErrorHandler.createError({ message: `fsck: Cannot start check at '${startPath}': ${pathValidation.error}` });
        }

        const output = [];
        const issues = [];
        let changesMade = false;

        await OutputManager.appendToOutput(`Starting filesystem check at '${startPath}'...`);

        /**
         * Phase 1: Audits the structural integrity of filesystem nodes.
         * Checks for missing properties and type inconsistencies.
         */
        const structuralAudit = async () => {
            const auditIssues = [];
            const traverse = (path, node) => {
                const requiredProps = ['type', 'owner', 'group', 'mode', 'mtime'];
                for (const prop of requiredProps) {
                    if (node[prop] === undefined) {
                        auditIssues.push({ type: 'MALFORMED_NODE', path, issue: `Malformed node: missing '${prop}' property.`, data: { node } });
                    }
                }
                if (node.type === 'directory' && (typeof node.children !== 'object' || node.children === null)) {
                    auditIssues.push({ type: 'TYPE_INCONSISTENCY', path, issue: "Directory node is missing or has invalid 'children' object.", data: { node } });
                } else if (node.type === 'file' && typeof node.content !== 'string') {
                    auditIssues.push({ type: 'TYPE_INCONSISTENCY', path, issue: "File node is missing 'content' string.", data: { node } });
                }
                if (node.type === Config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
                    const parentOfLink = path.substring(0, path.lastIndexOf('/')) || '/';
                    const targetPath = FileSystemManager.getAbsolutePath(node.target, parentOfLink);
                    const targetNode = FileSystemManager.getNodeByPath(targetPath);
                    if (!targetNode) {
                        auditIssues.push({ type: 'DANGLING_SYMLINK', path, issue: `Dangling symbolic link pointing to non-existent target '${node.target}'.`, data: { node } });
                    }
                }
                if (node.type === 'directory' && node.children) {
                    for (const childName in node.children) {
                        const childPath = FileSystemManager.getAbsolutePath(childName, path);
                        traverse(childPath, node.children[childName]);
                    }
                }
            };
            output.push("\n--- Phase 1: Structural Integrity Audit ---");
            traverse(pathValidation.data.resolvedPath, pathValidation.data.node);
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[STRUCTURAL ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ No structural issues found.");
            }
        };

        /**
         * Phase 2: Audits file and directory ownership.
         * Checks for orphaned owners and invalid group assignments.
         */
        const ownershipAudit = async () => {
            const auditIssues = [];
            const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            const userSet = new Set(Object.keys(allUsers));
            userSet.add(Config.USER.DEFAULT_NAME);

            const traverse = async (path, node) => {
                if (!userSet.has(node.owner)) {
                    auditIssues.push({ type: 'ORPHANED_OWNER', path, issue: `Orphaned file: owner '${node.owner}' does not exist.`, data: { node } });
                }
                if (!GroupManager.groupExists(node.group)) {
                    auditIssues.push({ type: 'INVALID_GROUP', path, issue: `Invalid group: group '${node.group}' does not exist.`, data: { node } });
                }
                if (node.type === 'directory' && node.children) {
                    for (const childName in node.children) {
                        const childPath = FileSystemManager.getAbsolutePath(childName, path);
                        await traverse(childPath, node.children[childName]);
                    }
                }
            };
            output.push("\n--- Phase 2: Ownership and Permissions Review ---");
            await traverse(pathValidation.data.resolvedPath, pathValidation.data.node);
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[OWNERSHIP ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ All file ownership and groups are valid.");
            }
        };

        /**
         * Phase 3: Audits user home directories.
         * Checks for missing home directories or incorrect ownership.
         */
        const homeDirectoryAudit = async () => {
            const auditIssues = [];
            const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            const userList = Object.keys(allUsers);
            userList.push(Config.USER.DEFAULT_NAME);

            output.push("\n--- Phase 3: User Homestead Inspection ---");
            for (const username of new Set(userList)) {
                const homePath = `/home/${username}`;
                const homeNode = FileSystemManager.getNodeByPath(homePath);
                if (!homeNode) {
                    auditIssues.push({ type: 'MISSING_HOME', path: homePath, issue: `User '${username}' is missing a home directory.`, data: { username } });
                } else if (homeNode.type !== 'directory') {
                    auditIssues.push({ type: 'INCORRECT_HOME_TYPE', path: homePath, issue: `Home path for user '${username}' is not a directory.`, data: { username, node: homeNode } });
                } else if (homeNode.owner !== username) {
                    auditIssues.push({ type: 'INCORRECT_HOME_OWNER', path: homePath, issue: `Home directory for user '${username}' is not owned by that user (owned by '${homeNode.owner}').`, data: { username, node: homeNode } });
                }
            }
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[HOME DIR ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ All users have a valid home directory.");
            }
        };

        /**
         * Phase 4: Permission Sanity Check.
         * Scans for common permission mistakes.
         */
        const permissionSanityAudit = async () => {
            const auditIssues = [];
            const sensitiveDirs = ['/etc'];

            const traverse = (path, node) => {
                // Check for world-writable files in sensitive directories
                if (sensitiveDirs.some(dir => path.startsWith(dir)) && (node.mode & 0o002)) {
                    auditIssues.push({
                        type: 'WORLD_WRITABLE_SENSITIVE',
                        path,
                        issue: `Sensitive file or directory is world-writable (mode ${node.mode.toString(8)}).`,
                        data: { node }
                    });
                }

                // Check for publicly readable private files (e.g., in .journal)
                if (path.includes('/.journal/') && (node.mode & 0o004)) {
                    auditIssues.push({
                        type: 'PUBLICLY_READABLE_PRIVATE',
                        path,
                        issue: `Private file is publicly readable (mode ${node.mode.toString(8)}).`,
                        data: { node }
                    });
                }

                // Check for non-executable scripts in /bin
                if (path.startsWith('/bin/') && node.type === 'file' && !(node.mode & 0o111)) {
                    auditIssues.push({
                        type: 'NON_EXECUTABLE_SCRIPT',
                        path,
                        issue: `Script in /bin is not executable (mode ${node.mode.toString(8)}).`,
                        data: { node }
                    });
                }

                if (node.type === 'directory' && node.children) {
                    for (const childName in node.children) {
                        const childPath = FileSystemManager.getAbsolutePath(childName, path);
                        traverse(childPath, node.children[childName]);
                    }
                }
            };

            output.push("\n--- Phase 4: Permission Sanity Check ---");
            traverse(pathValidation.data.resolvedPath, pathValidation.data.node);

            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[PERMISSION ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ No common permission issues found.");
            }
        };

        /**
         * Phase 5: Interactive or automatic repair mode.
         * Prompts the user to fix each detected issue, or fixes them automatically with -y.
         */
        const performRepairs = async () => {
            output.push("\n--- Phase 5: Interactive Repair ---");
            let quitRepair = false;
            for (const issue of issues) {
                if (quitRepair) break;

                await OutputManager.appendToOutput(`\nIssue found at '${issue.path}': ${issue.issue}`);
                let choice;
                let actionResult = { success: false, message: "No action taken." };

                const getChoice = async (prompt) => {
                    if (autoYes) {
                        return '1'; // Default safe action for all prompts
                    }
                    return new Promise(resolve => ModalManager.request({
                        context: 'terminal', type: 'input', messageLines: prompt,
                        onConfirm: val => resolve(val.trim().toLowerCase()),
                        onCancel: () => resolve('q'),
                        options
                    }));
                };

                switch (issue.type) {
                    case 'DANGLING_SYMLINK':
                    case 'MALFORMED_NODE':
                    case 'TYPE_INCONSISTENCY':
                        choice = await getChoice(["[1] Delete node", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            const rmResult = await FileSystemManager.deleteNodeRecursive(issue.path, { force: true, currentUser: 'root' });
                            actionResult = { success: rmResult.success, message: rmResult.success ? `Deleted '${issue.path}'.` : `Failed to delete.` };
                        }
                        break;
                    case 'ORPHANED_OWNER':
                        choice = autoYes ? '1' : await getChoice(["[1] Assign to 'root'", "[2] Assign to another user", "[3] Delete", "[4] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.owner = 'root';
                            actionResult = { success: true, message: "Owner reassigned to 'root'." };
                        } else if (choice === '2') {
                            const newOwner = await new Promise(resolve => ModalManager.request({
                                context: 'terminal', type: 'input', messageLines: ["Enter new owner's username:"],
                                onConfirm: val => resolve(val.trim()),
                                onCancel: () => resolve(null),
                                options
                            }));
                            if (newOwner && await UserManager.userExists(newOwner)) {
                                issue.data.node.owner = newOwner;
                                actionResult = { success: true, message: `Owner reassigned to '${newOwner}'.` };
                            } else {
                                actionResult = { success: false, message: `User '${newOwner}' not found. No action taken.` };
                            }
                        } else if (choice === '3') {
                            const rmResult = await FileSystemManager.deleteNodeRecursive(issue.path, { force: true, currentUser: 'root' });
                            actionResult = { success: rmResult.success, message: rmResult.success ? `Deleted '${issue.path}'.` : `Failed to delete.` };
                        }
                        break;
                    case 'INVALID_GROUP':
                        choice = await getChoice(["[1] Reassign group to 'root'", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.group = 'root';
                            actionResult = { success: true, message: "Group reassigned to 'root'." };
                        }
                        break;
                    case 'MISSING_HOME':
                        choice = await getChoice(["[1] Create home directory", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            await FileSystemManager.createUserHomeDirectory(issue.data.username);
                            actionResult = { success: true, message: `Created '${issue.path}'.` };
                        }
                        break;
                    case 'INCORRECT_HOME_TYPE':
                        choice = await getChoice(["[1] Delete incorrect item and create directory", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            const rmResult = await FileSystemManager.deleteNodeRecursive(issue.path, { force: true, currentUser: 'root' });
                            if (rmResult.success) {
                                await FileSystemManager.createUserHomeDirectory(issue.data.username);
                                actionResult = { success: true, message: `Replaced incorrect home item with directory for '${issue.data.username}'.` };
                            } else {
                                actionResult = { success: false, message: `Could not remove incorrect home item for '${issue.data.username}'.` };
                            }
                        }
                        break;
                    case 'INCORRECT_HOME_OWNER':
                        choice = await getChoice(["[1] Correct ownership", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.owner = issue.data.username;
                            issue.data.node.group = issue.data.username;
                            actionResult = { success: true, message: `Ownership of '${issue.path}' corrected.` };
                        }
                        break;
                    case 'WORLD_WRITABLE_SENSITIVE':
                        choice = await getChoice(["[1] Remove world-writable permission (safe fix)", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.mode &= ~0o002; // Remove write permission for 'others'
                            actionResult = { success: true, message: `Removed world-writable permission from '${issue.path}'.` };
                        }
                        break;
                    case 'PUBLICLY_READABLE_PRIVATE':
                        choice = await getChoice(["[1] Remove public read permission (safe fix)", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.mode &= ~0o004; // Remove read permission for 'others'
                            actionResult = { success: true, message: `Removed public read permission from '${issue.path}'.` };
                        }
                        break;
                    case 'NON_EXECUTABLE_SCRIPT':
                        choice = await getChoice(["[1] Make script executable (safe fix)", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.mode |= 0o111; // Add execute permission for all
                            actionResult = { success: true, message: `Made script '${issue.path}' executable.` };
                        }
                        break;
                    default:
                        actionResult = { success: true, message: `No automatic repair available for this issue type.` };
                        break;
                }

                await OutputManager.appendToOutput(actionResult.message, { typeClass: actionResult.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG });
                if (actionResult.success && choice !== '2' && choice !== '4' && choice !== 'ignore' && !autoYes) changesMade = true;
                if (autoYes && actionResult.success) changesMade = true;
                if (choice === 'q') quitRepair = true;
            }
            if (quitRepair) output.push("\nRepair process quit by user.");
        };

        await structuralAudit();
        await ownershipAudit();
        await homeDirectoryAudit();
        await permissionSanityAudit();

        if (repairMode && issues.length > 0) {
            await performRepairs();
        }

        output.push("\n--- Filesystem Check Summary ---");
        if (issues.length > 0 && !repairMode) {
            output.push(`Found ${issues.length} potential issue(s).`);
            output.push("Run with the --repair flag to attempt to fix them.");
        } else if (changesMade) {
            output.push("Repairs complete. Filesystem has been modified.");
        }
        else {
            output.push("  ✅ Filesystem appears to be healthy.");
        }

        if(changesMade) {
            await FileSystemManager.save();
        }

        return ErrorHandler.createSuccess(output.join('\n'), { stateModified: changesMade });
    }
}

window.CommandRegistry.register(new FsckCommand());