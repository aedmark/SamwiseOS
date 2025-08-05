// scripts/commands/kill.js

/**
 * @fileoverview This file defines the 'kill' command, a utility for sending
 * signals to background jobs to terminate, pause, or resume them.
 * @module commands/kill
 */

/**
 * Represents the 'kill' command for managing background jobs.
 * @class KillCommand
 * @extends Command
 */
window.KillCommand = class KillCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "kill",
      description: "Terminates, pauses, or continues background jobs.",
      helpText: `Usage: kill [signal] <job_id>
      Send a signal to a background job.
      DESCRIPTION
      The kill command sends a signal to the background job identified by
      <job_id>. Use the 'ps' command to get a list of active background jobs.
      SIGNALS
      -s, --signal <signal>
            Specify the signal to send. Can be KILL, TERM, STOP, or CONT.
      -STOP
            Stop (pause) the job.
      -CONT
            Continue (resume) a stopped job.
      -KILL
            Forcibly terminate the job.
      If no signal is specified, the default is to terminate the job (TERM).
      EXAMPLES
      kill 1
      Terminates job 1.
      kill -STOP 1
      Pauses job 1. You will see its status as 'T' in 'ps'.
      kill -CONT 1
      Resumes job 1.`,
      flagDefinitions: [
        { name: "signal", short: "-s", long: "--signal", takesValue: true },
        { name: "STOP", short: "-STOP" },
        { name: "CONT", short: "-CONT" },
        { name: "KILL", short: "-KILL" },
        { name: "TERM", short: "-TERM" },
      ],
      argValidation: {
        min: 1,
        error: "Usage: kill [signal] <job_id>",
      },
    });
  }

  /**
   * Executes the core logic of the 'kill' command.
   * It parses the specified signal and job ID from the arguments, validates them,
   * and then uses the CommandExecutor to send the signal to the target job.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { args, flags, dependencies } = context;
    const { ErrorHandler, CommandExecutor, Utils } = dependencies;

    let signal = "TERM";
    const signalFlags = ["STOP", "CONT", "KILL", "TERM"];
    let signalsProvided = [];

    if (flags.signal) {
      signalsProvided.push(flags.signal.toUpperCase());
    }
    signalFlags.forEach(sig => {
      if (flags[sig]) {
        signalsProvided.push(sig);
      }
    });

    if (signalsProvided.length > 1) {
      return ErrorHandler.createError({ message: "kill: only one signal may be specified." });
    }
    if (signalsProvided.length === 1) {
      signal = signalsProvided[0];
    }

    const validSignals = ["KILL", "TERM", "STOP", "CONT"];
    if (!validSignals.includes(signal)) {
      return ErrorHandler.createError({ message: `kill: invalid signal: ${signal}` });
    }

    const jobIdArg = args[0];
    const parsedJobId = Utils.parseNumericArg(jobIdArg, { allowFloat: false, allowNegative: false });

    if (parsedJobId.error) {
      return ErrorHandler.createError({ message: `kill: invalid job ID: ${jobIdArg}` });
    }
    const jobId = parsedJobId.value;

    const result = CommandExecutor.sendSignalToJob(jobId, signal);

    if (result.success) {
      return ErrorHandler.createSuccess(result.data || "");
    } else {
      return ErrorHandler.createError({ message: result.error || "Failed to send signal to job." });
    }
  }
}

window.CommandRegistry.register(new KillCommand());