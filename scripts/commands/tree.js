/**
 * @fileoverview This file defines the 'tree' command, a utility for displaying
 * the contents of a directory and its subdirectories in a tree-like format.
 * @module commands/tree
 */

/**
 * Represents the 'tree' command.
 * @class TreeCommand
 * @extends Command
 */
window.TreeCommand = class TreeCommand extends Command {
    /**
     * @constructor
     */
    constructor() {
        super({
            commandName: "tree",
            description: "Lists directory contents in a tree-like format.",
            helpText: `Usage: tree [OPTION]... [PATH]
      List the contents of directories in a tree-like format.
      DESCRIPTION
      The tree command recursively lists the contents of the given
      directory PATH, or the current directory if none is specified,
      in a visually structured tree.
      OPTIONS
      -L <level>
      Descend only <level> directories deep.
      -d
      List directories only.
      EXAMPLES
      tree
      Displays the entire directory tree starting from the
      current location.
      tree -L 2 /home
      Displays the first two levels of the /home directory.
      tree -d
      Displays only the subdirectories, not the files.`,
            completionType: "paths",
            flagDefinitions: [
                { name: "level", short: "-L", long: "--level", takesValue: true },
                { name: "dirsOnly", short: "-d", long: "--dirs-only" },
            ],
            argValidation: {
                max: 1,
            },
            pathValidation: {
                argIndex: 0,
                options: { expectedType: "directory" },
                permissions: ["read"],
            },
        });
    }

    /**
     * Executes the core logic of the 'tree' command. It recursively traverses
     * the specified directory, building a string representation of the file
     * structure. It respects depth limits and options to show only directories,
     * and concludes with a summary of the files and directories found.
     * @param {object} context - The command execution context.
     * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
     */
    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { ErrorHandler, FileSystemManager, Utils, Config } = dependencies;

        const pathArg = args.length > 0 ? args[0] : '.';

        const pathValidationResult = FileSystemManager.validatePath(pathArg, {
            expectedType: "directory",
            permissions: ["read"],
        });

        if (!pathValidationResult.success) {
            return ErrorHandler.createError({ message: `tree: cannot access '${pathArg}': ${pathValidationResult.error}` });
        }
        const { resolvedPath } = pathValidationResult.data;

        const maxDepth = flags.level
            ? Utils.parseNumericArg(flags.level, { min: 0 })
            : { value: Infinity };

        if (flags.level && (maxDepth.error || maxDepth.value === null))
            return ErrorHandler.createError({ message: `tree: invalid level value for -L: '${flags.level}' ${maxDepth.error || ""}` });

        const outputLines = [resolvedPath];
        let dirCount = 0;
        let fileCount = 0;

        function buildTreeRecursive(
            currentDirPath,
            currentDepth,
            indentPrefix
        ) {
            if (currentDepth > maxDepth.value) return;

            const currentNode = FileSystemManager.getNodeByPath(currentDirPath);
            if (
                !currentNode ||
                currentNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            )
                return;

            if (
                currentDepth > 1 &&
                !FileSystemManager.hasPermission(currentNode, currentUser, "read")
            ) {
                outputLines.push(indentPrefix + "└── [Permission Denied]");
                return;
            }

            const childrenNames = Object.keys(currentNode.children).sort();

            childrenNames.forEach((childName, index) => {
                const childNode = currentNode.children[childName];
                const branchPrefix =
                    index === childrenNames.length - 1 ? "└── " : "├── ";

                if (childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    dirCount++;
                    outputLines.push(
                        indentPrefix +
                        branchPrefix +
                        childName +
                        Config.FILESYSTEM.PATH_SEPARATOR
                    );
                    if (currentDepth < maxDepth.value)
                        buildTreeRecursive(
                            FileSystemManager.getAbsolutePath(childName, currentDirPath),
                            currentDepth + 1,
                            indentPrefix +
                            (index === childrenNames.length - 1 ? "    " : "│   ")
                        );
                } else if (!flags.dirsOnly) {
                    fileCount++;
                    outputLines.push(indentPrefix + branchPrefix + childName);
                }
            });
        }
        buildTreeRecursive(resolvedPath, 1, "");

        outputLines.push("");
        let report = `${dirCount} director${dirCount === 1 ? "y" : "ies"}`;
        if (!flags.dirsOnly)
            report += `, ${fileCount} file${fileCount === 1 ? "" : "s"}`;
        outputLines.push(report);

        return ErrorHandler.createSuccess(outputLines.join("\n"));
    }
}

window.CommandRegistry.register(new TreeCommand());