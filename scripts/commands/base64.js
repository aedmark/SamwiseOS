/**
 * @file scripts/commands/base64.js
 * @description The 'base64' command, a utility for encoding and decoding data using the Base64 standard,
 * leveraging the browser's built-in `btoa` and `atob` functions.
 */

/**
 * Represents the 'base64' command for encoding and decoding data.
 * @class Base64Command
 * @extends Command
 */
window.Base64Command = class Base64Command extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "base64",
      description: "Encode or decode data and print to standard output.",
      helpText: `Usage: base64 [OPTION]... [FILE]

Base64 encode or decode FILE, or standard input, to standard output.

DESCRIPTION
       The base64 command encodes or decodes data using the Base64 standard.
       This is useful for safely transmitting binary data through text-based channels.
       With no FILE, or when FILE is -, it reads from standard input.

OPTIONS
       -d, --decode
              Decode data.

EXAMPLES
       base64 my_script.sh
              Encodes the script and prints the Base64 string to the terminal.

       base64 my_script.sh > encoded.txt
              Encodes the script and saves the output to a new file.

       cat encoded.txt | base64 -d
              Decodes the content of 'encoded.txt' and prints the original script.`,
      isInputStream: true,
      completionType: "paths",
      flagDefinitions: [{ name: "decode", short: "-d", long: "--decode" }],
    });
  }

  /**
   * Main logic for the 'base64' command.
   * It reads from the input stream (file or stdin), and either encodes or decodes
   * the content based on the presence of the '--decode' flag.
   * @param {object} context - The command execution context.
   * @param {object} context.flags - The parsed command-line flags.
   * @param {Array<object>} context.inputItems - The content read from the input stream.
   * @param {boolean} context.inputError - A flag indicating if there was an error reading the input.
   * @param {object} context.dependencies - System dependencies.
   * @returns {Promise<object>} The result of the command execution.
   */
  async coreLogic(context) {
    const { flags, inputItems, inputError, dependencies } = context;
    const { ErrorHandler } = dependencies;

    if (inputError) {
      return ErrorHandler.createError(
          "base64: No readable input provided or permission denied."
      );
    }

    if (!inputItems || inputItems.length === 0) {
      return ErrorHandler.createSuccess("");
    }

    const inputData = inputItems.map((item) => item.content).join("\n");

    try {
      if (flags.decode) {
        // Decode the input data from Base64
        const decodedData = atob(inputData);
        return ErrorHandler.createSuccess(decodedData);
      } else {
        // Encode the input data to Base64 and format with newlines every 64 characters
        const encodedData = btoa(inputData);
        return ErrorHandler.createSuccess(
            encodedData.replace(/(.{64})/g, "$1\n")
        );
      }
    } catch (e) {
      // Handle potential errors from atob (e.g., invalid characters)
      if (e instanceof DOMException && e.name === "InvalidCharacterError") {
        return ErrorHandler.createError("base64: invalid input");
      }
      // Re-throw other unexpected errors
      throw e;
    }
  }
}

window.CommandRegistry.register(new Base64Command());