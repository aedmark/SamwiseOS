/**
 * @fileoverview This file defines the 'planner' command, a utility for managing
 * shared project to-do lists.
 * @module commands/planner
 */

/**
 * Represents the 'planner' command for project task management.
 * @class PlannerCommand
 * @extends Command
 */
window.PlannerCommand = class PlannerCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "planner",
            description: "Manages shared project to-do lists.",
            helpText: `Usage: planner <project_name> [sub-command] [options]

Manages shared project plans stored in /etc/projects/.

SUB-COMMANDS:
  (no sub-command)     Displays the status board for <project_name>.
  create               Creates a new project plan. Usage: sudo planner create <name>
  add "<task>"         Adds a new task to the <project_name> plan.
  assign <user> <id>   Assigns a task ID to a user.
  done <id>            Marks a task ID as complete.

EXAMPLES:
  sudo planner create launch_party
  planner launch_party add "Book venue"
  planner launch_party assign Guest 1
  planner launch_party done 1
  planner launch_party`,
        });
    }

    /**
     * Main logic for the 'planner' command. Acts as a router for sub-commands.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;
        const subCommandOrProject = args[0];

        if (!subCommandOrProject) {
            return ErrorHandler.createError("planner: missing project name or sub-command. See 'help planner'.");
        }

        if (subCommandOrProject === 'create') {
            return this._handleCreate(context);
        }

        // All other commands use project name as the first argument
        const projectName = subCommandOrProject;
        const subCommand = args[1];

        if (!subCommand) {
            return this._handleList(context, projectName);
        }

        switch (subCommand.toLowerCase()) {
            case "add":
                return this._handleAdd(context, projectName);
            case "assign":
                return this._handleAssign(context, projectName);
            case "done":
                return this._handleDone(context, projectName);
            default:
                return ErrorHandler.createError(`planner: unknown sub-command '${subCommand}'.`);
        }
    }

    _getProjectPath(projectName) {
        return `/etc/projects/${projectName}.json`;
    }

    async _readProjectFile(projectName, dependencies) {
        const { FileSystemManager, ErrorHandler } = dependencies;
        const path = this._getProjectPath(projectName);
        const fileNode = FileSystemManager.getNodeByPath(path);

        if (!fileNode) {
            return { error: `Project '${projectName}' not found.` };
        }
        if (fileNode.type !== 'file') {
            return { error: `'${path}' is not a valid project file.` };
        }

        try {
            const data = JSON.parse(fileNode.content || '{}');
            return { data };
        } catch (e) {
            return { error: `Could not parse project file for '${projectName}'.` };
        }
    }

    async _writeProjectFile(projectName, data, context) {
        const { currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;
        const path = this._getProjectPath(projectName);

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            path,
            JSON.stringify(data, null, 2),
            { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return { success: true };
        } else {
            return { success: false, error: saveResult.error };
        }
    }

    async _handleCreate(context) {
        const { args, currentUser, dependencies } = context;
        const { ErrorHandler, CommandExecutor } = dependencies;

        if (currentUser !== 'root') {
            return ErrorHandler.createError("planner create: only root can create new projects.");
        }
        if (args.length !== 2) {
            return ErrorHandler.createError("Usage: sudo planner create <project_name>");
        }

        const projectName = args[1];
        const projectDir = '/etc/projects';

        await CommandExecutor.processSingleCommand(`mkdir -p ${projectDir}`, { isInteractive: false });

        const initialData = {
            projectName: projectName,
            tasks: []
        };

        const writeResult = await this._writeProjectFile(projectName, initialData, context);

        if (writeResult.success) {
            return ErrorHandler.createSuccess(`Project '${projectName}' created successfully.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`planner: ${writeResult.error}`);
        }
    }

    async _handleList(context, projectName) {
        const { dependencies } = context;
        const { ErrorHandler, Config } = dependencies;
        const { data, error } = await this._readProjectFile(projectName, dependencies);

        if (error) {
            return ErrorHandler.createError(`planner: ${error}`);
        }

        let output = `\n  Project Status: ${data.projectName}\n`;
        output += `  ${'-'.repeat(70)}\n`;

        if (data.tasks.length === 0) {
            output += "  No tasks yet. Use 'planner add \"<task>\"' to add one.\n";
        } else {
            output += `  ID   STATUS      ASSIGNEE      TASK\n`;
            output += `  ${'-'.repeat(70)}\n`;
            data.tasks.forEach(task => {
                const id = String(task.id).padEnd(4);
                let status = task.status.toUpperCase();
                let statusColor = '';

                switch (task.status) {
                    case 'done':
                        statusColor = Config.CSS_CLASSES.SUCCESS_MSG;
                        break;
                    case 'assigned':
                        statusColor = Config.CSS_CLASSES.WARNING_MSG;
                        break;
                    default:
                        statusColor = Config.CSS_CLASSES.INFO_MSG;
                }
                status = `<span class="${statusColor}">${status.padEnd(9)}</span>`;
                const assignee = (task.assignee || 'none').padEnd(13);
                output += `  ${id} ${status} ${assignee} ${task.description}\n`;
            });
        }
        output += `  ${'-'.repeat(70)}\n`;
        return ErrorHandler.createSuccess(output, { asBlock: true });
    }

    async _handleAdd(context, projectName) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (args.length !== 3) {
            return ErrorHandler.createError("Usage: planner <project> add \"<task>\"");
        }
        const description = args[2];

        const { data, error } = await this._readProjectFile(projectName, dependencies);
        if (error) {
            return ErrorHandler.createError(`planner: ${error}`);
        }

        const newId = (Math.max(0, ...data.tasks.map(t => t.id)) || 0) + 1;
        data.tasks.push({
            id: newId,
            description: description,
            status: "open",
            assignee: "none"
        });

        const writeResult = await this._writeProjectFile(projectName, data, context);
        if (writeResult.success) {
            return ErrorHandler.createSuccess(`Added task ${newId} to '${projectName}'.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`planner: ${writeResult.error}`);
        }
    }

    async _handleAssign(context, projectName) {
        const { args, dependencies } = context;
        const { ErrorHandler, UserManager } = dependencies;

        if (args.length !== 4) {
            return ErrorHandler.createError("Usage: planner <project> assign <user> <task_id>");
        }
        const user = args[2];
        const taskId = parseInt(args[3], 10);

        if (!(await UserManager.userExists(user))) {
            return ErrorHandler.createError(`planner: user '${user}' does not exist.`);
        }
        if (isNaN(taskId)) {
            return ErrorHandler.createError(`planner: invalid task ID '${args[3]}'.`);
        }

        const { data, error } = await this._readProjectFile(projectName, dependencies);
        if (error) {
            return ErrorHandler.createError(`planner: ${error}`);
        }

        const task = data.tasks.find(t => t.id === taskId);
        if (!task) {
            return ErrorHandler.createError(`planner: task with ID ${taskId} not found in '${projectName}'.`);
        }

        task.assignee = user;
        task.status = 'assigned';

        const writeResult = await this._writeProjectFile(projectName, data, context);
        if (writeResult.success) {
            return ErrorHandler.createSuccess(`Task ${taskId} assigned to ${user}.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`planner: ${writeResult.error}`);
        }
    }

    async _handleDone(context, projectName) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (args.length !== 3) {
            return ErrorHandler.createError("Usage: planner <project> done <task_id>");
        }
        const taskId = parseInt(args[2], 10);

        if (isNaN(taskId)) {
            return ErrorHandler.createError(`planner: invalid task ID '${args[2]}'.`);
        }

        const { data, error } = await this._readProjectFile(projectName, dependencies);
        if (error) {
            return ErrorHandler.createError(`planner: ${error}`);
        }

        const task = data.tasks.find(t => t.id === taskId);
        if (!task) {
            return ErrorHandler.createError(`planner: task with ID ${taskId} not found in '${projectName}'.`);
        }

        task.status = 'done';

        const writeResult = await this._writeProjectFile(projectName, data, context);
        if (writeResult.success) {
            return ErrorHandler.createSuccess(`Task ${taskId} marked as done.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`planner: ${writeResult.error}`);
        }
    }
}

window.CommandRegistry.register(new PlannerCommand());