// scripts/commands/curl.js

/**
 * @fileoverview Defines the 'curl' command, a utility for transferring data from a server
 * using URL syntax, supporting HTTP redirects and outputting to files or standard output.
 * @module commands/curl
 */

/**
 * Represents the 'curl' command for data transfer.
 * @class CurlCommand
 * @extends Command
 */
window.CurlCommand = class CurlCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "curl",
      description: "Transfer data from or to a server.",
      helpText: `Usage: curl [options] <URL>
      Transfer data from or to a server.
      DESCRIPTION
      curl is a tool to transfer data from or to a server. By default,
      it prints the fetched content to standard output.
      Note: Due to browser security restrictions, curl is subject to
      Cross-Origin Resource Sharing (CORS) policies and may not be able
      to fetch content from all URLs.
      OPTIONS
      -o, --output <file>
      Write output to <file> instead of standard output.
      -i, --include
      Include protocol response headers in the output.
      -L, --location
      Follow redirects.
      EXAMPLES
      curl https://api.github.com/zen
      Displays a random piece of GitHub zen wisdom.
      curl -o page.html https://example.com
      Downloads the content of example.com and saves it to a
      file named 'page.html'.`,
      completionType: "paths",
      flagDefinitions: [
        {
          name: "output",
          short: "-o",
          long: "--output",
          takesValue: true,
        },
        {
          name: "include",
          short: "-i",
          long: "--include",
        },
        {
          name: "location",
          short: "-L",
          long: "--location",
        },
      ],
      validations: {
        args: {
          min: 1,
          error: "Usage: curl [options] <URL>"
        }
      },
    });
  }

  /**
   * Executes the core logic of the 'curl' command.
   * This function fetches content from a given URL, handles HTTP redirects if specified,
   * includes headers if requested, and either prints the result to standard output or
   * saves it to a file.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {
    const { args, flags, currentUser, dependencies } = context;
    const { FileSystemManager, UserManager, ErrorHandler } = dependencies;
    let currentUrl = args[0];
    const maxRedirects = 10;

    try {
      for (let i = 0; i < maxRedirects; i++) {
        const response = await fetch(currentUrl, { redirect: "manual" });

        if (
            response.status >= 300 &&
            response.status < 400 &&
            response.headers.has("location")
        ) {
          if (!flags.location) {
            return ErrorHandler.createError({
              message: `Redirected to ${response.headers.get("location")}`,
              suggestion: "Use the -L flag to follow redirects.",
            });
          }
          currentUrl = new URL(response.headers.get("location"), currentUrl)
              .href;
          continue;
        }

        const content = await response.text();
        let outputString = "";

        if (flags.include) {
          outputString += `HTTP/1.1 ${response.status} ${response.statusText}\n`;
          response.headers.forEach((value, name) => {
            outputString += `${name}: ${value}\n`;
          });
          outputString += "\n";
        }

        outputString += content;

        if (flags.output) {
          const pathValidationResult = FileSystemManager.validatePath(
              flags.output,
              {
                allowMissing: true,
                expectedType: "file",
              }
          );

          if (!pathValidationResult.success) {
            return ErrorHandler.createError(
                `curl: ${pathValidationResult.error}`
            );
          }
          const pathValidation = pathValidationResult.data;
          if (
              pathValidation.node &&
              pathValidation.node.type === "directory"
          ) {
            return ErrorHandler.createError(
                `curl: output file '${flags.output}' is a directory`
            );
          }

          const primaryGroup =
              UserManager.getPrimaryGroupForUser(currentUser);
          if (!primaryGroup) {
            return ErrorHandler.createError(
                "curl: critical - could not determine primary group for user."
            );
          }

          const saveResult = await FileSystemManager.createOrUpdateFile(
              pathValidation.resolvedPath,
              outputString,
              {
                currentUser,
                primaryGroup,
              }
          );

          if (!saveResult.success) {
            return ErrorHandler.createError(`curl: ${saveResult.error}`);
          }
          await FileSystemManager.save();
          return ErrorHandler.createSuccess("");
        } else {
          return ErrorHandler.createSuccess(outputString);
        }
      }

      return ErrorHandler.createError("curl: Too many redirects.");
    } catch (e) {
      let error = {
        message: "Failed to connect to host.",
        suggestion: "This is often a network issue or a CORS policy preventing access from the browser."
      };
      if (e instanceof URIError) {
        error.message = `URL using bad/illegal format or missing URL`;
        error.suggestion = `Check the syntax of your URL: ${currentUrl}`;
      }
      return ErrorHandler.createError(error);
    }
  }
}

window.CommandRegistry.register(new CurlCommand());