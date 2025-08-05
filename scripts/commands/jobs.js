// scripts/commands/jobs.js

/**
 * @fileoverview This file defines the 'jobs' command, a utility for listing
 * all active background jobs initiated in the current user session.
 * @module commands/jobs
 */

/**
 * Represents the 'jobs' command.
 * @class JobsCommand
 * @extends Command
 */
window.JobsCommand = class JobsCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "jobs",
            description: "Lists active background jobs for the current session.",
            helpText: `Usage: jobs
      Lists the background jobs that were started from the current terminal.
      DESCRIPTION
      The jobs command provides a list of processes that are running in the
      background. This is similar to 'ps', but is typically used to manage
      jobs that can be brought to the foreground with 'fg'.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'jobs' command.
     * It retrieves the list of active background jobs from the CommandExecutor
     * and formats them for display, showing their ID, status, and command.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;
        const jobs = CommandExecutor.getActiveJobs();
        const outputLines = [];

        Object.values(jobs).forEach((job, index) => {
            outputLines.push(`[${job.id}]  ${job.status.padEnd(8)}  ${job.command}`);
        });

        if (outputLines.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        return ErrorHandler.createSuccess(outputLines.join("\n"));
    }
}

window.CommandRegistry.register(new JobsCommand());