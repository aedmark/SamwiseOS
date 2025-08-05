// /scripts/message_bus_manager.js

/**
 * Manages inter-process communication for background jobs and daemons.
 * It provides a simple message queue system where a command or process
 * can register a unique ID to receive messages from other parts of the system.
 * It's our own little chat room for commands.
 * @class MessageBusManager
 */
class MessageBusManager {
  /**
   * @constructor
   */
  constructor() {
    /**
     * A map of job IDs to their message queues.
     * @type {Map<number|string, Array>}
     */
    this.jobQueues = new Map();
  }

  /**
   * Registers a job to receive messages. This creates a new, empty queue for the job ID.
   * @param {number|string} jobId - The unique ID of the job or daemon.
   */
  registerJob(jobId) {
    if (!this.jobQueues.has(jobId)) {
      this.jobQueues.set(jobId, []);
    }
  }

  /**
   * Unregisters a job, removing its message queue.
   * @param {number|string} jobId - The ID of the job to unregister.
   */
  unregisterJob(jobId) {
    this.jobQueues.delete(jobId);
  }

  /**
   * Checks if a job is registered.
   * @param {number|string} jobId - The ID of the job.
   * @returns {boolean} True if the job is registered, false otherwise.
   */
  hasJob(jobId) {
    return this.jobQueues.has(jobId);
  }

  /**
   * Posts a message to a specific job's queue.
   * @param {number|string} jobId - The ID of the job to send the message to.
   * @param {*} message - The message content.
   * @returns {{success: boolean, error?: string}} A result object indicating success or failure.
   */
  postMessage(jobId, message) {
    if (!this.jobQueues.has(jobId)) {
      return { success: false, error: "No such job ID registered." };
    }
    const queue = this.jobQueues.get(jobId);
    queue.push(message);
    return { success: true };
  }

  /**
   * Retrieves all messages from a job's queue and clears the queue.
   * This is a one-way street, like a fax machine for commands.
   * @param {number|string} jobId - The ID of the job.
   * @returns {Array} An array of messages. Returns an empty array if the job is not found.
   */
  getMessages(jobId) {
    if (!this.jobQueues.has(jobId)) {
      return [];
    }
    const messages = this.jobQueues.get(jobId);
    this.jobQueues.set(jobId, []); // Clear the queue after reading
    return messages;
  }
}