/**
 * @file /scripts/commands/agenda.js
 * @description The 'agenda' command, which allows users to schedule other commands to run at specific times,
 * and the AgendaDaemon class, a background service that executes these scheduled jobs.
 */

/**
 * Represents the 'agenda' command for scheduling tasks. This command acts as a user-facing
 * interface to interact with the AgendaDaemon background process.
 * @class AgendaCommand
 * @extends Command
 */
window.AgendaCommand = class AgendaCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "agenda",
            description: "Schedules commands to run at specified times or intervals.",
            helpText: `Usage: agenda <sub-command> [options]
      Manages scheduled background tasks.

      SUB-COMMANDS:
        add "<cron>" "<cmd>"  - Schedules a new command. (Requires root)
        list                 - Lists all scheduled commands.
        remove <id>          - Removes a scheduled command by its ID. (Requires root)
        start-daemon         - (Internal) Starts the scheduling service.`,
            isInputStream: false,
        });
    }

    /**
     * Main logic for the 'agenda' command. It parses sub-commands and ensures the
     * AgendaDaemon is running before passing tasks to it.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { ErrorHandler, CommandExecutor, OutputManager } = dependencies;
        const subCommand = args[0];

        if (!subCommand) {
            return ErrorHandler.createError("agenda: missing sub-command. Use 'add', 'list', or 'remove'.");
        }

        if (['add', 'remove'].includes(subCommand.toLowerCase()) && currentUser !== 'root') {
            return ErrorHandler.createError(`agenda: modifying the schedule requires root privileges. Try 'sudo agenda ${args.join(' ')}'.`);
        }

        // Internal command to start the daemon process
        if (subCommand === '--daemon-start') {
            const daemon = new AgendaDaemon(dependencies);
            await daemon.run();
            return ErrorHandler.createSuccess("Agenda daemon started.");
        }

        // Check if the daemon is running, start it if it's not
        const psResult = await CommandExecutor.processSingleCommand("ps", { isInteractive: false });
        const isDaemonRunning = psResult.output && psResult.output.includes("agenda --daemon-start");

        if (!isDaemonRunning) {
            await OutputManager.appendToOutput("Starting agenda daemon for the first time...");
            await CommandExecutor.processSingleCommand("agenda --daemon-start &", { isInteractive: false });
            await new Promise(resolve => setTimeout(resolve, 500)); // Give daemon time to initialize
        }

        switch (subCommand.toLowerCase()) {
            case "add":
                return this._handleAdd(context);
            case "list":
                return this._handleList(context);
            case "remove":
                return this._handleRemove(context);
            default:
                return ErrorHandler.createError(`agenda: unknown sub-command '${subCommand}'.`);
        }
    }

    /**
     * Handles the 'add' sub-command by sending a message to the daemon.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     * @private
     */
    async _handleAdd(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, MessageBusManager } = dependencies;

        if (args.length < 3) {
            return ErrorHandler.createError(`agenda add: expected at least 3 arguments, got ${args.length}. Usage: sudo agenda add "<cron_string>" "<command>"`);
        }
        const [_, cronString, ...commandParts] = args;
        const command = commandParts.join(' ');

        if (!cronString || !command) {
            return ErrorHandler.createError("Cron string and command must be provided.");
        }

        // Post a message to the daemon to add a new job
        MessageBusManager.postMessage('agenda-daemon', {
            type: 'ADD_JOB',
            payload: { cronString, command }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        return ErrorHandler.createSuccess("Job submitted to the agenda.");
    }

    /**
     * Handles the 'list' sub-command by reading the schedule file.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     * @private
     */
    async _handleList(context) {
        const { dependencies } = context;
        const { FileSystemManager, ErrorHandler } = dependencies;
        const schedulePath = '/etc/agenda.json';

        const scheduleNode = FileSystemManager.getNodeByPath(schedulePath);
        if (!scheduleNode) {
            return ErrorHandler.createSuccess("No scheduled jobs found.");
        }

        try {
            const schedule = JSON.parse(scheduleNode.content || '[]');
            if (schedule.length === 0) {
                return ErrorHandler.createSuccess("The agenda is currently empty.");
            }
            let output = "ID  Schedule             Command\n";
            output += "-------------------------------------\n";
            schedule.forEach(job => {
                output += `${String(job.id).padEnd(3)} ${job.cronString.padEnd(20)} ${job.command}\n`;
            });
            return ErrorHandler.createSuccess(output);
        } catch (e) {
            return ErrorHandler.createError("Could not read the agenda file. It may be corrupt.");
        }
    }

    /**
     * Handles the 'remove' sub-command by sending a message to the daemon.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     * @private
     */
    async _handleRemove(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, MessageBusManager } = dependencies;

        if (args.length !== 2) {
            return ErrorHandler.createError("Usage: sudo agenda remove <job_id>");
        }
        const jobId = parseInt(args[1], 10);
        if (isNaN(jobId)) {
            return ErrorHandler.createError("Invalid Job ID.");
        }

        MessageBusManager.postMessage('agenda-daemon', {
            type: 'REMOVE_JOB',
            payload: { jobId }
        });

        return ErrorHandler.createSuccess(`Sent request to remove job ${jobId}.`);
    }
}

window.CommandRegistry.register(new AgendaCommand());

/**
 * The background service that manages and executes scheduled commands.
 * @class AgendaDaemon
 */
class AgendaDaemon {
    /**
     * @constructor
     * @param {object} dependencies - The dependency injection container.
     */
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.schedule = [];
        this.schedulePath = '/etc/agenda.json';
        this.jobCounter = 0;
        this.isRunning = false;
    }

    /**
     * Loads the schedule from the filesystem.
     * @private
     */
    async _loadSchedule() {
        const { FileSystemManager } = this.dependencies;
        const node = FileSystemManager.getNodeByPath(this.schedulePath);
        if (node) {
            try {
                this.schedule = JSON.parse(node.content || '[]');
                this.jobCounter = this.schedule.reduce((maxId, job) => Math.max(maxId, job.id), 0);
            } catch (e) {
                console.error("AgendaDaemon: Could not parse schedule file.", e);
                this.schedule = [];
            }
        }
    }

    /**
     * Saves the current schedule to the filesystem.
     * @private
     */
    async _saveSchedule() {
        const { FileSystemManager } = this.dependencies;
        const content = JSON.stringify(this.schedule, null, 2);

        const saveResult = await FileSystemManager.createOrUpdateFile(
            this.schedulePath,
            content,
            { currentUser: 'root', primaryGroup: 'root' }
        );

        if (saveResult.success) {
            const scheduleNode = FileSystemManager.getNodeByPath(this.schedulePath);
            if (scheduleNode) {
                scheduleNode.owner = 'root';
                scheduleNode.group = 'root';
                scheduleNode.mode = 0o644; // Read-write for root, read-only for others
            }
            await FileSystemManager.save();
        }
    }

    /**
     * Parses a cron string into its components.
     * @param {string} cronString - The cron string to parse.
     * @returns {object|null} The parsed cron components or null if invalid.
     * @private
     */
    _parseCron(cronString) {
        const parts = cronString.split(' ');
        if (parts.length !== 5) return null;
        const [minute, hour, dayOfMonth] = parts;
        return { minute, hour, dayOfMonth };
    }

    /**
     * Checks the schedule against the current time and executes any due commands.
     * @param {Date} now - The current time.
     * @private
     */
    _checkSchedule(now) {
        const { CommandExecutor } = this.dependencies;
        this.schedule.forEach(job => {
            const cron = this._parseCron(job.cronString);
            if (!cron) return;

            let shouldRun = true;
            if (cron.minute !== '*' && parseInt(cron.minute) !== now.getMinutes()) shouldRun = false;
            if (cron.hour !== '*' && parseInt(cron.hour) !== now.getHours()) shouldRun = false;
            if (cron.dayOfMonth !== '*' && parseInt(cron.dayOfMonth) !== now.getDate()) shouldRun = false;
            // DayOfWeek and Month are ignored in this simplified version

            if (shouldRun) {
                console.log(`AgendaDaemon: Executing job ${job.id}: ${job.command}`);
                CommandExecutor.processSingleCommand(job.command, { isInteractive: false });
            }
        });
    }

    /**
     * Handles incoming messages from the message bus to modify the schedule.
     * @param {object} message - The message payload from the message bus.
     * @private
     */
    async _handleMessage(message) {
        if (!message || !message.type) return;

        switch (message.type) {
            case 'ADD_JOB':
                this.jobCounter++;
                this.schedule.push({ id: this.jobCounter, ...message.payload });
                await this._saveSchedule();
                break;
            case 'REMOVE_JOB':
                this.schedule = this.schedule.filter(job => job.id !== message.payload.jobId);
                await this._saveSchedule();
                break;
        }
    }

    /**
     * Starts the daemon, loads the schedule, and begins the main loop.
     */
    async run() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("AgendaDaemon: Starting up.");
        await this._loadSchedule();
        this.dependencies.MessageBusManager.registerJob('agenda-daemon');
        await this._runDaemonLoop();
    }

    /**
     * The main execution loop for the daemon.
     * @private
     */
    async _runDaemonLoop() {
        while (true) {
            try {
                const now = new Date();
                await this._processMessages();
                this._checkSchedule(now);
                await this._waitUntilNextMinute(now);
            } catch (error) {
                console.error("AgendaDaemon: Encountered an error in the main loop, but I'm doing my best!", error);
                // Wait before retrying to avoid rapid-fire errors
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Processes all pending messages from the message bus.
     * @private
     */
    async _processMessages() {
        const messages = this.dependencies.MessageBusManager.getMessages('agenda-daemon');
        for (const msg of messages) {
            await this._handleMessage(msg);
        }
    }

    /**
     * Calculates the time until the next minute and waits.
     * @param {Date} currentTime - The current time.
     * @private
     */
    async _waitUntilNextMinute(currentTime) {
        const secondsUntilNextMinute = 60 - currentTime.getSeconds();
        await new Promise(resolve => setTimeout(resolve, secondsUntilNextMinute * 1000));
    }
}