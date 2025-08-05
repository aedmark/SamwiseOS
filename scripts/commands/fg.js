// scripts/commands/fg.js

/**
 * @fileoverview This file defines the 'fg' command, a utility for resuming
 * a stopped or background job and bringing it to the foreground.
 * @module commands/fg
 */

/**
 * Represents the 'fg' (foreground) command.
 * @class FgCommand
 * @extends Command
 */
window.FgCommand = class FgCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "fg",
            description: "Resumes a job in the foreground.",
            helpText: `Usage: fg [%job_id]
      Resumes a stopped or background job in the foreground.
      DESCRIPTION
      The fg (foreground) command brings the specified job to the
      foreground, making it the active process in the terminal. If no
      job ID is specified, the most recently backgrounded job is used.
      (Note: True foreground process control is not yet implemented in OopisOS, this command currently only resumes a stopped job).`,
            validations: {
                args: {
                    max: 1
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'fg' command.
     * It parses an optional job ID and sends a 'CONT' (continue) signal
     * to the specified job, or the most recent job if none is specified.
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
                    message: `fg: invalid job ID: ${jobIdArg}`,
                    suggestion,
                });
            }
            const result = CommandExecutor.sendSignalToJob(jobId, 'CONT');
            return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError({ message: result.error, suggestion });
        } else {
            const jobs = CommandExecutor.getActiveJobs();
            const jobIds = Object.keys(jobs);
            if (jobIds.length > 0) {
                const lastJobId = jobIds[jobIds.length - 1];
                const result = CommandExecutor.sendSignalToJob(parseInt(lastJobId, 10), 'CONT');
                return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError({ message: result.error, suggestion });
            } else {
                return ErrorHandler.createError({
                    message: "fg: no current job",
                    suggestion,
                });
            }
        }
    }
}

window.CommandRegistry.register(new FgCommand());