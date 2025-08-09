/**
 * @file /scripts/commands/agenda.js
 * @description [REFACTORED] This file now contains the AgendaDaemon background service
 * and a simple command to ensure the daemon is running. The user-facing sub-commands
 * (add, list, remove) are now handled by `gem/core/commands/agenda.py`.
 */

/**
 * A simple command to ensure the agenda daemon is running.
 * @class AgendaStarterCommand
 * @extends Command
 */
window.AgendaStarterCommand = class AgendaStarterCommand extends Command {
    constructor() {
        super({
            commandName: "agenda-daemon-starter",
            description: "Ensures the agenda daemon is running.",
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { CommandExecutor, OutputManager } = dependencies;

        const psResult = await CommandExecutor.processSingleCommand("ps", { isInteractive: false });
        const isDaemonRunning = psResult.data && psResult.data.includes("agenda --daemon-start");

        if (!isDaemonRunning) {
            await OutputManager.appendToOutput("Starting agenda daemon service...");
            // Execute the daemon script in the background
            await CommandExecutor.processSingleCommand("run /bin/agendadaemon &", { isInteractive: false });
            await new Promise(resolve => setTimeout(resolve, 500)); // Give it a moment to start
        }
        return dependencies.ErrorHandler.createSuccess();
    }
};
window.CommandRegistry.register(new AgendaStarterCommand());


/**
 * The background service that manages and executes scheduled commands.
 * This class MUST remain in JavaScript to handle timed execution via setInterval.
 * @class AgendaDaemon
 */
class AgendaDaemon {
    /**
     * @constructor
     * @param {object} dependencies - The dependency injection container.
     */
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.schedulePath = '/etc/agenda.json';
        this.lastCheckedMinute = -1;
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
        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
        return { minute, hour, dayOfMonth, month, dayOfWeek };
    }

    /**
     * Checks the schedule against the current time and executes any due commands.
     * @param {Date} now - The current time.
     * @private
     */
    async _checkSchedule(now) {
        const { CommandExecutor, FileSystemManager } = this.dependencies;
        const scheduleNode = await FileSystemManager.getNodeByPath(this.schedulePath);
        if (!scheduleNode) return;

        let schedule = [];
        try {
            schedule = JSON.parse(scheduleNode.content || '[]');
        } catch(e) {
            console.error("AgendaDaemon: Could not parse schedule file.");
            return;
        }

        for (const job of schedule) {
            const cron = this._parseCron(job.cronString);
            if (!cron) continue;

            let shouldRun = true;
            if (cron.minute !== '*' && parseInt(cron.minute) !== now.getMinutes()) shouldRun = false;
            if (cron.hour !== '*' && parseInt(cron.hour) !== now.getHours()) shouldRun = false;
            if (cron.dayOfMonth !== '*' && parseInt(cron.dayOfMonth) !== now.getDate()) shouldRun = false;
            if (cron.month !== '*' && parseInt(cron.month) !== (now.getMonth() + 1)) shouldRun = false;
            if (cron.dayOfWeek !== '*' && parseInt(cron.dayOfWeek) !== now.getDay()) shouldRun = false;

            if (shouldRun) {
                console.log(`AgendaDaemon: Executing job ${job.id}: ${job.command}`);
                // Execute as root for system tasks
                await CommandExecutor.sudoExecute(job.command, { isInteractive: false });
            }
        }
    }

    /**
     * Starts the daemon's main execution loop.
     */
    run() {
        console.log("AgendaDaemon: Starting up.");
        setInterval(() => {
            const now = new Date();
            if (now.getMinutes() !== this.lastCheckedMinute) {
                this.lastCheckedMinute = now.getMinutes();
                this._checkSchedule(now);
            }
        }, 10000); // Check every 10 seconds
    }
}

// To make the daemon runnable via `run` command, we need a simple script file for it in VFS
// and a command to start it.
window.AgendaDaemonRunner = class AgendaDaemonRunner extends Command {
    constructor() {
        super({ commandName: "agenda-daemon-runner" });
    }
    async coreLogic(context) {
        const daemon = new AgendaDaemon(context.dependencies);
        daemon.run();
        // This command will run in the background and never resolve, which is correct for a daemon.
        return new Promise(() => {});
    }
};
window.CommandRegistry.register(new AgendaDaemonRunner());