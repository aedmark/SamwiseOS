/**
 * @file /scripts/commands/storyboard.js
 * @description The 'storyboard' command, a utility for analyzing and summarizing the relationships between files in a directory.
 */

/**
 * Represents the 'storyboard' command. It analyzes file contents and metadata to generate a narrative or logical summary of a project's structure.
 * @class StoryboardCommand
 * @extends Command
 */
window.StoryboardCommand = class StoryboardCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "storyboard",
            description: "Analyzes and creates a narrative summary of files and their relationships.",
            helpText: `Usage: storyboard [options] [path]
      <command> | storyboard [options]

      Analyzes a set of files to describe their collective purpose and structure.

      MODES OF OPERATION:
      1.  Path Mode:
          Run 'storyboard [path]' to analyze a specific file or all supported files within a directory. Defaults to the current directory.
      2.  Piped Mode:
          Pipe the output of another command (like 'find' or 'ls') to create a custom set of files for analysis.

      OPTIONS:
        -m, --mode <mode>       Sets the analysis mode. Modes can be:
                                  - code: (Default) Follows imports, function calls, and dependencies.
                                  - narrative: Looks for thematic links and sequential naming.
                                  - chronological: Orders the story by file modification time.
        -s, --summary           Provides a single, concise paragraph summary.
        --ask "<question>"      Asks a specific question about the file relationships.

      EXAMPLES:
        storyboard ./src
        Analyzes the 'src' directory to explain its code architecture.

        find . -name "*.md" | storyboard --mode narrative
        Creates a story from all Markdown files in the current project.

        storyboard --ask "Which file handles user authentication?"
        Analyzes the current directory to answer a specific question.`,
            isInputStream: true, // Required to accept piped input
            completionType: "paths",
            flagDefinitions: [
                { name: "mode", short: "-m", long: "--mode", takesValue: true },
                { name: "summary", short: "-s", long: "--summary" },
                { name: "ask", long: "--ask", takesValue: true },
            ]
        });
        this.SUPPORTED_EXTENSIONS = new Set(["md", "txt", "html", "js", "sh", "css", "json"]);
    }

    /**
     * Recursively traverses a directory to find all supported files for analysis.
     * @param {string} startPath - The absolute path to start the search from.
     * @param {object} startNode - The filesystem node corresponding to the startPath.
     * @param {object} context - The command context.
     * @returns {Promise<Array<object>>} A promise resolving to an array of file objects.
     * @private
     */
    async _getFilesFromDirectory(startPath, startNode, context) {
        const { currentUser, dependencies } = context;
        const { FileSystemManager, Utils } = dependencies;
        const files = [];
        const visited = new Set();

        const recurse = async (currentPath, node) => {
            if (visited.has(currentPath) || !node) return;
            visited.add(currentPath);

            if (!FileSystemManager.hasPermission(node, currentUser, "read")) return;

            if (node.type === "directory") {
                if (!FileSystemManager.hasPermission(node, currentUser, "execute")) return;
                for (const childName of Object.keys(node.children || {}).sort()) {
                    await recurse(
                        FileSystemManager.getAbsolutePath(childName, currentPath),
                        node.children[childName]
                    );
                }
            } else if (node.type === "file") {
                if (this.SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(currentPath))) {
                    files.push({
                        name: currentPath.split("/").pop(),
                        path: currentPath,
                        content: node.content || "",
                    });
                }
            }
        };

        await recurse(startPath, startNode);
        return files;
    }

    /**
     * Main logic for the 'storyboard' command.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} The result of the command execution.
     */
    async coreLogic(context) {
        const { args, flags, dependencies, inputItems, currentUser } = context;
        const { ErrorHandler, OutputManager, FileSystemManager, Utils, AIManager, Config } = dependencies;

        let filesToAnalyze = [];
        let hadErrors = false;

        if (args.length > 0) {
            // Path Argument Mode
            const startPathArg = args[0];
            const pathResult = FileSystemManager.validatePath(startPathArg, { permissions: ['read'] });
            if (!pathResult.success) {
                return ErrorHandler.createError(`storyboard: ${pathResult.error}`);
            }

            const { node, resolvedPath } = pathResult.data;

            if (node.type === 'file') {
                if (this.SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(resolvedPath))) {
                    filesToAnalyze.push({
                        name: resolvedPath.split("/").pop(),
                        path: resolvedPath,
                        content: node.content || "",
                    });
                }
            } else if (node.type === 'directory') {
                filesToAnalyze = await this._getFilesFromDirectory(resolvedPath, node, context);
            }
        } else if (inputItems && inputItems.length > 0 && inputItems[0].content) {
            // Piped Mode
            const pathsFromPipe = inputItems[0].content.trim().split('\n');
            for (const path of pathsFromPipe) {
                if (!path.trim()) continue;
                const pathValidationResult = FileSystemManager.validatePath(path, {
                    expectedType: "file",
                    permissions: ["read"],
                });
                if (!pathValidationResult.success) {
                    await OutputManager.appendToOutput(
                        `storyboard: Skipping invalid or unreadable path from pipe: ${path}`,
                        { typeClass: Config.CSS_CLASSES.WARNING_MSG }
                    );
                    hadErrors = true;
                    continue;
                }
                const pathValidation = pathValidationResult.data;
                if (this.SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(pathValidation.resolvedPath))) {
                    filesToAnalyze.push({
                        name: pathValidation.resolvedPath.split("/").pop(),
                        path: pathValidation.resolvedPath,
                        content: pathValidation.node.content || "",
                    });
                }
            }
        }

        if (filesToAnalyze.length === 0) {
            return ErrorHandler.createSuccess("No supported files found to analyze.");
        }

        await OutputManager.appendToOutput(`Found ${filesToAnalyze.length} relevant files. Consulting the AI Project Historian...`, { typeClass: "text-info" });

        const apiKeyResult = await AIManager.getApiKey('gemini', { isInteractive: true, dependencies });
        if (!apiKeyResult.success) {
            return ErrorHandler.createError(`storyboard: ${apiKeyResult.error}`);
        }
        const apiKey = apiKeyResult.data.key;

        const fileContextString = filesToAnalyze
            .map(file => `--- START FILE: ${file.path} ---\\n${file.content}\\n--- END FILE: ${file.path} ---`)
            .join("\\n\\n")
            .substring(0, 15000);

        let userPrompt;
        const mode = flags.mode || 'code';

        if (flags.ask) {
            userPrompt = `Using the provided file contents as context, answer the following question: "${flags.ask}"`;
        } else if (flags.summary) {
            userPrompt = `Provide a single, concise paragraph summarizing the entire structure and purpose of the provided files.`;
        } else {
            userPrompt = `Based on the following files and their content, describe the story and relationship between them. Analyze them in '${mode}' mode to explain the project's architecture and purpose. Present your findings in clear, well-structured Markdown.`;
        }

        const fullPrompt = `${userPrompt}\\n\\nFILE CONTEXT:\\n${fileContextString}`;
        const systemPrompt = "You are a helpful AI Project Historian. Your task is to analyze a collection of files and explain their collective story, structure, and purpose based ONLY on the provided content.";

        const result = await AIManager.callLlmApi(
            'gemini',
            null,
            [{ role: "user", parts: [{ text: fullPrompt }] }],
            apiKey,
            systemPrompt
        );

        if (result.success) {
            const storyHtml = DOMPurify.sanitize(marked.parse(result.answer));
            const headerHtml = `<h3>Project Storyboard</h3>`;
            return ErrorHandler.createSuccess(
                headerHtml + storyHtml,
                { asBlock: true, messageType: 'prose-output' }
            );
        } else {
            return ErrorHandler.createError(`storyboard: The AI Historian could not complete the report. Reason: ${result.error}`);
        }
    }
};

window.CommandRegistry.register(new StoryboardCommand());