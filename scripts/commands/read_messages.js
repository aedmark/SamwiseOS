// scripts/commands/read_messages.js

/**
 * @fileoverview This file defines the 'read_messages' command, a utility for
 * background jobs to retrieve messages from their dedicated message queue.
 * @module commands/read_messages
 */

/**
 * Represents the 'read_messages' command.
 * @class ReadMessagesCommand
 * @extends Command
 */
window.ReadMessagesCommand = class ReadMessagesCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "read_messages",
            description: "Reads all messages from a job's message queue.",
            helpText: `Usage: read_messages <job_id>
      Read all messages from a background job's message queue.
      DESCRIPTION
      The read_messages command retrieves all pending string messages for
      the specified <job_id>. This is the counterpart to 'post_message'.
      Once read, the messages are removed from the queue.
      This command is intended for use within scripts ('run' command) to
      allow background processes to be controlled by other processes.
      The output is a space-separated string of all messages.
      EXAMPLES
      (In a script running as job 2)
      loop_variable=true
      while $loop_variable; do
          messages=$(read_messages 2)
          if [[ "$messages" == "stop" ]]; then
              loop_variable=false
          fi
          delay 1000
      done`,
            validations: {
                args: {
                    exact: 1
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'read_messages' command.
     * It parses the job ID, retrieves all pending messages for that ID from
     * the MessageBusManager, and returns them as a single space-separated string.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, dependencies } = context;
        const { MessageBusManager, ErrorHandler } = dependencies;

        try {
            const jobId = parseInt(args[0], 10);

            if (isNaN(jobId)) {
                return ErrorHandler.createError(
                    `read_messages: invalid job ID: ${args[0]}`
                );
            }

            const messages = MessageBusManager.getMessages(jobId);
            return ErrorHandler.createSuccess(messages.join(" "));
        } catch (e) {
            return ErrorHandler.createError(
                `read_messages: An unexpected error occurred: ${e.message}`
            );
        }
    }
}

window.CommandRegistry.register(new ReadMessagesCommand());