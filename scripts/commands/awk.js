/**
 * @file scripts/commands/awk.js
 * @description The 'awk' command, a powerful tool for pattern scanning and text processing.
 * This is a simplified implementation supporting basic pattern-action rules.
 */

/**
 * Represents the 'awk' command for pattern scanning and text processing.
 * @class AwkCommand
 * @extends Command
 */
window.AwkCommand = class AwkCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "awk",
      description: "Pattern scanning and text processing language.",
      helpText: `Usage: awk 'program' [file...]
       awk -F<separator> 'program' [file...]

A tool for pattern scanning and processing.

DESCRIPTION
       awk scans each input file for lines that match any of a set of
       patterns specified in the 'program'. The program consists of
       a series of rules, each with a pattern and an action.

       This version of awk supports a subset of features:
       - Patterns must be regular expressions enclosed in slashes (e.g., /error/).
       - The only supported action is 'print'.
       - Special patterns BEGIN and END are supported.
       - Built-in variables NR (line number) and NF (number of fields) are available.
       - Field variables like $0 (the whole line), $1, $2, etc., are available.

OPTIONS
       -F<separator>
              Use the specified separator to split fields. Can be a single
              character or a regular expression.

EXAMPLES
       ls -l | awk '{print $9}'
              Prints only the 9th column (the filename) from the output of ls -l.

       awk -F, '{print $1}' data.csv
              Prints the first column of a comma-separated file.

       awk '/success/ {print "Found:", $0}' app.log
              Prints "Found:" followed by the full line for every line containing
              "success" in the file app.log.`,
      completionType: "paths",
      isInputStream: true,
      flagDefinitions: [
        { name: "fieldSeparator", short: "-F", takesValue: true },
      ],
      firstFileArgIndex: 1,
    });
  }

  /**
   * Parses the user-provided awk script into a structured object.
   * It identifies BEGIN blocks, END blocks, and pattern-action rules.
   * @private
   * @param {string} programString - The raw awk program string.
   * @returns {{begin: string|null, end: string|null, rules: Array<object>, error: string|null}} The parsed program structure.
   */
  _parseProgram(programString) {
    const program = { begin: null, end: null, rules: [], error: null };
    const ruleRegex =
        /(BEGIN)\s*{([^}]*)}|(END)\s*{([^}]*)}|(\/[^/]*\/)\s*{([^}]*)}/g;
    let match;
    while ((match = ruleRegex.exec(programString)) !== null) {
      if (match[1]) {
        program.begin = match[2].trim();
      } else if (match[3]) {
        program.end = match[4].trim();
      } else if (match[5]) {
        try {
          const pattern = new RegExp(match[5].slice(1, -1));
          program.rules.push({ pattern: pattern, action: match[6].trim() });
        } catch (e) {
          program.error = `Invalid regex pattern: ${match[5]}`;
          return program;
        }
      }
    }
    if (
        programString.trim() &&
        !program.begin &&
        !program.end &&
        program.rules.length === 0
    ) {
      const simpleActionMatch = programString.trim().match(/^{([^}]*)}$/);
      if (simpleActionMatch) {
        program.rules.push({
          pattern: /.*/,
          action: simpleActionMatch[1].trim(),
        });
      } else {
        program.error = `Unrecognized program format: ${programString}`;
      }
    }
    return program;
  }

  /**
   * Executes a given action string (currently only 'print').
   * Replaces field variables ($0, $1) and built-in variables (NR, NF) with their values.
   * @private
   * @param {string} action - The action string to execute, e.g., "print $1, $2".
   * @param {string[]} fields - The fields of the current line, where fields[0] is the whole line ($0).
   * @param {object} vars - An object containing built-in variables like { NR, NF }.
   * @returns {string|null} The formatted string for printing, or null if the action is not supported.
   */
  _executeAction(action, fields, vars) {
    if (action.startsWith("print")) {
      let argsStr = action.substring(5).trim();
      if (argsStr === "") {
        return fields[0];
      }

      argsStr = argsStr.replace(/\$(\d+)/g, (match, n) => {
        const index = parseInt(n, 10);
        return fields[index] || "";
      });

      argsStr = argsStr.replace(/\$0/g, fields[0] || "");
      argsStr = argsStr.replace(/NR/g, vars.NR);
      argsStr = argsStr.replace(/NF/g, vars.NF);

      return argsStr.replace(/,/g, " ").replace(/"/g, ""); // Also strip quotes
    }
    return null;
  }

  /**
   * Main logic for the 'awk' command.
   * It parses the program, processes the input line by line, applies the rules,
   * and generates the final output, handling BEGIN and END blocks.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} The result of the command execution.
   */
  async coreLogic(context) {
    const { flags, args, inputItems, inputError, dependencies } = context;
    const { ErrorHandler } = dependencies;

    if (args.length === 0) {
      return ErrorHandler.createError("awk: missing program");
    }

    if (inputError) {
      return ErrorHandler.createError(
          "awk: One or more input files could not be read."
      );
    }

    const programString = args[0];
    const program = this._parseProgram(programString);
    if (program.error) {
      return ErrorHandler.createError(
          `awk: program error: ${program.error}`
      );
    }

    if (!inputItems || inputItems.length === 0) {
      return ErrorHandler.createSuccess("");
    }

    const inputText = inputItems.map((item) => item.content).join("\n");
    const separator = flags.fieldSeparator
        ? new RegExp(flags.fieldSeparator)
        : /\s+/;
    let outputLines = [];
    let nr = 0;

    // BEGIN block
    if (program.begin) {
      const beginResult = this._executeAction(program.begin, [], {
        NR: 0,
        NF: 0,
      });
      if (beginResult !== null) {
        outputLines.push(beginResult);
      }
    }

    // Main processing loop
    const lines = inputText.split("\n");
    for (const line of lines) {
      if (line === "" && lines.at(-1) === "") continue;
      nr++;
      const trimmedLine = line.trim();
      let fields = trimmedLine === "" ? [] : trimmedLine.split(separator);
      if (!Array.isArray(fields)) fields = [];
      const allFields = [line, ...fields]; // $0 is the whole line
      const vars = { NR: nr, NF: fields.length };

      for (const rule of program.rules) {
        if (rule.pattern.test(line)) {
          const actionResult = this._executeAction(rule.action, allFields, vars);
          if (actionResult !== null) outputLines.push(actionResult);
        }
      }
    }

    // END block
    if (program.end) {
      const endResult = this._executeAction(program.end, [], { NR: nr, NF: 0 });
      if (endResult !== null) {
        outputLines.push(endResult);
      }
    }

    return ErrorHandler.createSuccess(outputLines.join("\n"));
  }
}

window.CommandRegistry.register(new AwkCommand());