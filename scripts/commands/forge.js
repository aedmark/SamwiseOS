/**
 * @fileoverview This file defines the 'forge' command, an AI-powered utility
 * for generating file content and code scaffolding from a user's description.
 * @module commands/forge
 */

/**
 * Represents the 'forge' command.
 * @class ForgeCommand
 * @extends Command
 */
window.ForgeCommand = class ForgeCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "forge",
            description: "AI-powered scaffolding and boilerplate generation tool.",
            helpText: `Usage: forge [OPTIONS] "<description>" [output_file]
      Generate file content using an AI model based on a description.

      DESCRIPTION
      The forge command is a powerful tool that leverages an AI model
      to generate code, scripts, or any text-based file from a simple
      natural language description. It acts as a boilerplate and scaffolding
      assistant, letting you create the initial structure of a file without
      writing it from scratch.

      If an [output_file] is specified, the content is saved to that file.
      If the output file has a '.sh' extension, 'forge' will automatically
      make it executable.

      If no output file is provided, the generated content is printed
      directly to the standard output, allowing it to be piped to other
      commands.

      PROVIDERS & MODELS
      -p, --provider <name>
            Specify the AI provider to use (e.g., 'gemini', 'ollama').
            Defaults to 'gemini'.
      -m, --model <name>
            Specify a particular model for the chosen provider.

      EXAMPLES
      forge "a simple html boilerplate" > index.html
      Creates a basic HTML file.

      forge "a shell script to list all .txt files" > list_docs.sh
      Generates a shell script and makes it executable.

      forge "a python function that takes two numbers and returns their sum"
      Prints the generated Python code directly to the terminal.`,
            flagDefinitions: [
                { name: "provider", short: "-p", long: "--provider", takesValue: true },
                { name: "model", short: "-m", long: "--model", takesValue: true },
            ],
            validations: {
                args: {
                    min: 1,
                    max: 2,
                    error: 'Usage: forge "<description>" [output_file]'
                }
            },
        });
    }

    /**
     * Executes the core logic of the 'forge' command.
     * It sends the user's description to an AI model to generate file content,
     * then either prints the result or saves it to a file, making scripts executable.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { AIManager, FileSystemManager, UserManager, CommandExecutor, ErrorHandler, OutputManager } = dependencies;

        const description = args[0];
        const outputFile = args.length === 2 ? args[1] : null;

        const systemPrompt = "You are an expert file generator. Your task is to generate the raw content for a file based on the user's description. Respond ONLY with the raw file content itself. Do not include explanations, apologies, or any surrounding text like ```language ...``` or 'Here is the content you requested:'.";

        await OutputManager.appendToOutput("Forging file from the ether... The AI is concentrating.", {
            typeClass: dependencies.Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        });

        const provider = flags.provider || 'gemini';
        const model = flags.model || null;

        const apiKeyResult = await AIManager.getApiKey(provider, { isInteractive: true, dependencies });
        if (!apiKeyResult.success) {
            return ErrorHandler.createError({ message: `forge: ${apiKeyResult.error}` });
        }
        const apiKey = apiKeyResult.data.key;

        const conversation = [{ role: "user", parts: [{ text: description }] }];

        const result = await AIManager.callLlmApi(
            provider,
            model,
            conversation,
            apiKey,
            systemPrompt
        );

        if (!result.success) {
            return ErrorHandler.createError({ message: `forge: The AI failed to generate the file. Reason: ${result.error}` });
        }

        const generatedContent = result.answer.trim();

        if (outputFile) {
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const saveResult = await FileSystemManager.createOrUpdateFile(
                outputFile,
                generatedContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                return ErrorHandler.createError({ message: `forge: ${saveResult.error}` });
            }

            if (outputFile.endsWith('.sh')) {
                await CommandExecutor.processSingleCommand(`chmod 755 "${outputFile}"`, { isInteractive: false });
                return ErrorHandler.createSuccess(`File '${outputFile}' forged and made executable.`, { stateModified: true });
            }

            return ErrorHandler.createSuccess(`File '${outputFile}' forged successfully.`, { stateModified: true });
        } else {
            return ErrorHandler.createSuccess(generatedContent);
        }
    }
}

window.CommandRegistry.register(new ForgeCommand());