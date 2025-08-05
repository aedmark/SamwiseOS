/**
 * @fileoverview This file defines the 'bg' command, a utility for resuming
 * a stopped background job.
 * @module commands/bg
 */

/**
 * Represents the 'bg' (background) command.
 * @class BgCommand
 * @extends Command
 */
window.BgCommand = class BgCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "bg",
            description: "Resumes a stopped job in the background.",
            helpText: `Usage: bg [%job_id]
      Resumes a stopped background job.
      DESCRIPTION
      The bg (background) command resumes the specified job, keeping it
      in the background. If no job ID is specified, the most recently
      stopped job is used.`,
            validations: {
                args: {
                    max: 1
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'bg' command.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;
        const jobIdArg = args[0] ? args[0].replace('%', '') : null;
        const suggestion = "Use 'jobs' or 'ps' to see active jobs.";

        if (jobIdArg) {
            const jobId = parseInt(jobIdArg, 10);
            if (isNaN(jobId)) {
                return ErrorHandler.createError({
                    message: `bg: invalid job ID: ${jobIdArg}`,
                    suggestion,
                });
            }
            const result = CommandExecutor.sendSignalToJob(jobId, 'CONT');
            return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError({ message: result.error, suggestion });
        } else {
            const jobs = CommandExecutor.getActiveJobs();
            const jobIds = Object.keys(jobs).filter(id => jobs[id].status === 'paused');
            if (jobIds.length > 0) {
                const lastJobId = jobIds[jobIds.length - 1];
                const result = CommandExecutor.sendSignalToJob(parseInt(lastJobId, 10), 'CONT');
                return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError({ message: result.error, suggestion });
            } else {
                return ErrorHandler.createError({
                    message: "bg: no current job",
                    suggestion,
                });
            }
        }
    }
}

window.CommandRegistry.register(new BgCommand());