// scripts/commands/paint.js

/**
 * @fileoverview This file defines the 'paint' command, which launches the OopisOS
 * graphical character-based art editor application.
 * @module commands/paint
 */

/**
 * Represents the 'paint' command for launching the art editor.
 * @class PaintCommand
 * @extends Command
 */
window.PaintCommand = class PaintCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "paint",
      dependencies: ["apps/paint/paint_ui.js", "apps/paint/paint_manager.js"],
      applicationModules: ["PaintManager", "PaintUI", "App"],
      description: "Opens the character-based art editor.",
      helpText: `Usage: paint [filename.oopic]
    Launch the OopisOS character-based art editor.
    DESCRIPTION
    The paint command opens a full-screen, grid-based editor for
    creating ASCII and ANSI art. The canvas is 80 characters wide
    by 24 characters high.
    If a <filename> is provided, it will be opened. If it does not
    exist, it will be created upon saving. Files must have the
    '.oopic' extension.
    KEYBOARD SHORTCUTS
    P - Pencil      E - Eraser      L - Line      R - Rect
    G - Toggle Grid
    1-7 - Select Color (Red, Green, Blue, Yellow, Magenta, Cyan, White)
    Ctrl+S - Save and Exit
    Ctrl+O - Exit (prompts if unsaved)
    Ctrl+Z - Undo
    Ctrl+Y - Redo`,
      completionType: "paths",
      argValidation: {
        max: 1,
        error: "Usage: paint [filename.oopic]",
      },
    });
  }

  /**
   * Executes the core logic of the 'paint' command.
   * It ensures the session is interactive, validates the file path (ensuring
   * it has a '.oopic' extension), loads the file content if it exists, and then
   * launches the PaintManager application.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} A promise that resolves with a success or error object from the ErrorHandler.
   */
  async coreLogic(context) {

    const { args, options, dependencies } = context;
    const { ErrorHandler, AppLayerManager, PaintManager, PaintUI, App, FileSystemManager, Utils } = dependencies;

    try {
      if (!options.isInteractive) {
        return ErrorHandler.createError({
          message: "paint: Can only be run in interactive mode."
        });
      }

      if (
          typeof PaintManager === "undefined" ||
          typeof PaintUI === "undefined" ||
          typeof App === "undefined"
      ) {
        return ErrorHandler.createError({
          message: "paint: The Paint application module is not loaded."
        });
      }

      const pathArg =
          args.length > 0 ? args[0] : `untitled-${new Date().getTime()}.oopic`;
      const pathValidationResult = FileSystemManager.validatePath(pathArg, {
        allowMissing: true,
        expectedType: "file",
        permissions: ["read"],
      });

      if (!pathValidationResult.success && pathValidationResult.data?.node) {
        return ErrorHandler.createError({
          message: `paint: ${pathValidationResult.error}`
        });
      }
      const pathValidation = pathValidationResult.data;
      if (Utils.getFileExtension(pathValidation.resolvedPath) !== "oopic") {
        return ErrorHandler.createError({ message: `paint: can only edit .oopic files.` });
      }

      const fileContent = pathValidation.node
          ? pathValidation.node.content || ""
          : "";

      AppLayerManager.show(new PaintManager(), {
        filePath: pathValidation.resolvedPath,
        fileContent,
        dependencies: dependencies
      });

      return ErrorHandler.createSuccess("");
    } catch (e) {
      return ErrorHandler.createError({
        message: `paint: An unexpected error occurred: ${e.message}`
      });
    }

  }
}

window.CommandRegistry.register(new PaintCommand());