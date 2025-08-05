// scripts/utils.js

/**
 * @class Utils
 * @classdesc A static utility class providing a collection of helper functions
 * used throughout the OopisOS application. This includes text manipulation,
 * DOM creation, data formatting, and command-line parsing.
 */
class Utils {
  /**
   * Extracts comments from a string of code based on the file extension.
   * @param {string} content - The code content to parse.
   * @param {string} fileExtension - The file extension (e.g., 'js', 'sh').
   * @returns {string} A string containing all extracted comments, separated by newlines.
   */
  static extractComments(content, fileExtension) {
    let comments = [];
    let regex;

    switch (fileExtension) {
      case "js":
        regex = /(\/\*[\s\S]*?\*\/|\/\/.+)/g;
        break;
      case "sh":
        regex = /(^|\s)#.*$/gm;
        break;
      default:
        return "";
    }

    const matches = content.match(regex);
    if (matches) {
      comments = matches.map((comment) => {
        if (comment.startsWith("/*")) {
          return comment
              .replace(/^\/\*+/, "")
              .replace(/\*\/$/, "")
              .trim();
        } else {
          return comment.replace(/^\/\//, "").replace(/^#/, "").trim();
        }
      });
    }
    return comments.join("\n");
  }

  /**
   * Creates a debounced function that delays invoking `func` until after `delay` milliseconds
   * have elapsed since the last time the debounced function was invoked.
   * @param {Function} func - The function to debounce.
   * @param {number} delay - The number of milliseconds to delay.
   * @returns {Function} The new debounced function.
   */
  static debounce(func, delay) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  /**
   * Calculates the pixel dimensions (width and height) of a character for a given font style.
   * @param {string} [fontStyle='16px "VT323"'] - The CSS font style to measure.
   * @returns {{width: number, height: number}} An object containing the width and height.
   */
  static getCharacterDimensions(fontStyle = '16px "VT323"') {
    const tempSpan = document.createElement("span");
    tempSpan.textContent = "M";
    tempSpan.style.font = fontStyle;
    tempSpan.style.position = "absolute";
    tempSpan.style.left = "-9999px";
    tempSpan.style.top = "-9999px";
    tempSpan.style.visibility = "hidden";

    document.body.appendChild(tempSpan);
    const rect = tempSpan.getBoundingClientRect();
    document.body.removeChild(tempSpan);

    return { width: rect.width, height: rect.height };
  }

  /**
   * Calculates the SHA-256 hash of a given string.
   * @param {string} text - The text to hash.
   * @returns {Promise<string|null>} A promise that resolves to the hex-encoded hash string, or null on failure.
   */
  static async calculateSHA256(text) {
    if (typeof text !== "string") {
      return null;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("Password hashing failed:", error);
      return null;
    }
  }

  /**
   * Formats arguments for display in the terminal, similar to console.log.
   * @param {any[]} args - The arguments to format.
   * @returns {string} A single formatted string.
   */
  static formatConsoleArgs(args) {
    return Array.from(args)
        .map((arg) =>
            typeof arg === "object" && arg !== null
                ? JSON.stringify(arg)
                : String(arg)
        )
        .join(" ");
  }

  /**
   * Parses an array of arguments into a key-value pair based on the first '='.
   * @param {string[]} args - The arguments array.
   * @returns {{name: string, value: string|null}} An object with the parsed name and value.
   */
  static parseKeyValue(args) {
    const combined = args.join(" ");
    const eqIndex = combined.indexOf("=");

    if (eqIndex === -1) {
      return { name: combined.trim(), value: null };
    }

    const name = combined.substring(0, eqIndex).trim();
    let value = combined.substring(eqIndex + 1).trim();

    if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.substring(1, value.length - 1);
    }

    return { name, value };
  }

  /**
   * Creates a deep copy of a filesystem node using JSON serialization.
   * @param {object} node - The filesystem node to copy.
   * @returns {object|null} A deep copy of the node, or null if the input is null.
   */
  static deepCopyNode(node) {
    return node ? JSON.parse(JSON.stringify(node)) : null;
  }

  /**
   * Formats a number of bytes into a human-readable string (e.g., KB, MB).
   * @param {number} bytes - The number of bytes.
   * @param {number} [decimals=2] - The number of decimal places to use.
   * @returns {string} The formatted string.
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  /**
   * Extracts the file extension from a file path.
   * @param {string} filePath - The path to the file.
   * @returns {string} The file extension in lowercase, or an empty string if not found.
   */
  static getFileExtension(filePath) {
    if (!filePath || typeof filePath !== "string") return "";
    const separator =
        typeof Config !== "undefined" && Config.FILESYSTEM
            ? Config.FILESYSTEM.PATH_SEPARATOR
            : "/";
    const name = filePath.substring(filePath.lastIndexOf(separator) + 1);
    const lastDot = name.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0 || lastDot === name.length - 1) {
      return "";
    }
    return name.substring(lastDot + 1).toLowerCase();
  }

  /**
   * A helper function to create and configure DOM elements.
   * @param {string} tag - The HTML tag for the element.
   * @param {object} [attributes={}] - An object of attributes to set on the element.
   * @param {...(Node|string)} childrenArgs - Child nodes or strings to append.
   * @returns {HTMLElement} The created DOM element.
   */
  static createElement(tag, attributes = {}, ...childrenArgs) {
    const element = document.createElement(tag);
    for (const key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key)) {
        const value = attributes[key];
        if (key === "textContent") {
          element.textContent = value;
        } else if (key === "innerHTML") {
          element.innerHTML = value;
        } else if (key === "classList" && Array.isArray(value)) {
          element.classList.add(...value.filter((c) => typeof c === "string"));
        } else if (key === "className" && typeof value === "string") {
          element.className = value;
        } else if (key === "style" && typeof value === "object") {
          Object.assign(element.style, value);
        } else if (key === "eventListeners" && typeof value === "object") {
          for (const eventType in value) {
            if (Object.prototype.hasOwnProperty.call(value, eventType)) {
              element.addEventListener(eventType, value[eventType]);
            }
          }
        } else if (value !== null && value !== undefined) {
          element.setAttribute(key, String(value));
        }
      }
    }
    childrenArgs.flat().forEach((child) => {
      if (child instanceof Node) {
        element.appendChild(child);
      } else if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      }
    });
    return element;
  }

  /**
   * Validates the number of arguments passed to a command.
   * @param {string[]} argsArray - The array of arguments.
   * @param {object} [config={}] - The validation configuration.
   * @param {number} [config.exact] - The exact number of arguments required.
   * @param {number} [config.min] - The minimum number of arguments required.
   * @param {number} [config.max] - The maximum number of arguments allowed.
   * @returns {{isValid: boolean, errorDetail?: string}} An object indicating if the validation passed.
   */
  static validateArguments(argsArray, config = {}) {
    const argCount = argsArray.length;
    if (typeof config.exact === "number" && argCount !== config.exact) {
      return {
        isValid: false,
        errorDetail: `expected exactly ${config.exact} argument(s) but got ${argCount}`,
      };
    }
    if (typeof config.min === "number" && argCount < config.min) {
      return {
        isValid: false,
        errorDetail: `expected at least ${config.min} argument(s), but got ${argCount}`,
      };
    }
    if (typeof config.max === "number" && argCount > config.max) {
      return {
        isValid: false,
        errorDetail: `expected at most ${config.max} argument(s), but got ${argCount}`,
      };
    }
    return { isValid: true };
  }

  /**
   * Parses a string argument into a number with validation options.
   * @param {string} argString - The string to parse.
   * @param {object} [options={}] - The parsing and validation options.
   * @param {boolean} [options.allowFloat=false] - Whether to allow floating-point numbers.
   * @param {boolean} [options.allowNegative=false] - Whether to allow negative numbers.
   * @param {number} [options.min] - The minimum allowed value.
   * @param {number} [options.max] - The maximum allowed value.
   * @returns {{value: number|null, error: string|null}} The parsed number or an error object.
   */
  static parseNumericArg(argString, options = {}) {
    const { allowFloat = false, allowNegative = false, min, max } = options;
    const num = allowFloat ? parseFloat(argString) : parseInt(argString, 10);
    if (isNaN(num)) return { value: null, error: "is not a valid number" };
    if (!allowNegative && num < 0)
      return { value: null, error: "must be a non-negative number" };
    if (min !== undefined && num < min)
      return { value: null, error: `must be at least ${min}` };
    if (max !== undefined && num > max)
      return { value: null, error: `must be at most ${max}` };
    return { value: num, error: null };
  }

  /**
   * Validates a username against system rules (length, characters, reserved names).
   * @param {string} username - The username to validate.
   * @returns {{isValid: boolean, error: string|null}} An object indicating if the validation passed.
   */
  static validateUsernameFormat(username) {
    if (!username || typeof username !== "string" || username.trim() === "")
      return { isValid: false, error: "Username cannot be empty." };
    if (username.includes(" "))
      return { isValid: false, error: "Username cannot contain spaces." };
    if (
        typeof Config !== "undefined" &&
        Config.USER.RESERVED_USERNAMES.includes(username.toLowerCase())
    )
      return {
        isValid: false,
        error: `Cannot use '${username}'. This username is reserved.`,
      };
    if (
        typeof Config !== "undefined" &&
        username.length < Config.USER.MIN_USERNAME_LENGTH
    )
      return {
        isValid: false,
        error: `Username must be at least ${Config.USER.MIN_USERNAME_LENGTH} characters long.`,
      };
    if (
        typeof Config !== "undefined" &&
        username.length > Config.USER.MAX_USERNAME_LENGTH
    )
      return {
        isValid: false,
        error: `Username cannot exceed ${Config.USER.MAX_USERNAME_LENGTH} characters.`,
      };
    return { isValid: true, error: null };
  }

  /**
   * Parses an array of command-line arguments into flags and remaining arguments.
   * @param {string[]} argsArray - The array of arguments to parse.
   * @param {object[]} flagDefinitions - An array of flag definition objects.
   * @returns {{flags: object, remainingArgs: string[]}} An object containing parsed flags and other arguments.
   */
  static parseFlags(argsArray, flagDefinitions) {
    const flags = {};
    const remainingArgs = [];
    flagDefinitions.forEach((def) => {
      flags[def.name] = def.takesValue ? null : false;
    });

    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      if (!arg.startsWith("-") || arg === "-" || arg === "--") {
        remainingArgs.push(arg);
        continue;
      }

      const exactDef = flagDefinitions.find((d) =>
          [d.long, d.short, ...(d.aliases || [])].includes(arg)
      );
      if (exactDef) {
        if (exactDef.takesValue) {
          if (i + 1 < argsArray.length) {
            flags[exactDef.name] = argsArray[++i];
          }
        } else {
          flags[exactDef.name] = true;
        }
        continue;
      }

      if (!arg.startsWith("--") && arg.length > 2) {
        const shortFlag = arg.substring(0, 2);
        const valueTakingDef = flagDefinitions.find(
            (d) => [d.short].includes(shortFlag) && d.takesValue
        );
        if (valueTakingDef) {
          flags[valueTakingDef.name] = arg.substring(2);
          continue;
        }

        const chars = arg.substring(1);
        let consumed = true;
        for (const char of chars) {
          const charDef = flagDefinitions.find(
              (d) => [d.short].includes(`-${char}`) && !d.takesValue
          );
          if (charDef) {
            flags[charDef.name] = true;
          } else {
            consumed = false;
            break;
          }
        }
        if (consumed) continue;
      }

      remainingArgs.push(arg);
    }

    return { flags, remainingArgs };
  }

  /**
   * A promise-based wrapper for setTimeout.
   * @param {number} ms - The number of milliseconds to delay.
   * @returns {Promise<void>} A promise that resolves after the delay.
   */
  static safeDelay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Converts a simple glob pattern (supporting * and ?) into a regular expression.
   * @param {string} glob - The glob pattern.
   * @returns {RegExp|null} The corresponding regular expression, or null on error.
   */
  static globToRegex(glob) {
    if (glob === "*") return /.*/;

    let regexStr = "^";
    for (let i = 0; i < glob.length; i++) {
      const char = glob[i];
      switch (char) {
        case "*":
          regexStr += ".*";
          break;
        case "?":
          regexStr += ".";
          break;
        case "[":
          let charClass = "[";
          let k = i + 1;
          if (k < glob.length && (glob[k] === "!" || glob[k] === "^")) {
            charClass += "^";
            k++;
          }
          while (k < glob.length && glob[k] !== "]") {
            if (["\\", "-", "]"].includes(glob[k])) {
              charClass += "\\";
            }
            charClass += glob[k];
            k++;
          }
          if (k < glob.length && glob[k] === "]") {
            charClass += "]";
            i = k;
          } else {
            regexStr += "\\[";
          }
          break;
        default:
          if (/[.\\+?()|[\]{}^$]/.test(char)) {
            regexStr += "\\" + char;
          } else {
            regexStr += char;
          }
          break;
      }
    }
    regexStr += "$";
    try {
      return new RegExp(regexStr, "u");
    } catch (e) {
      console.warn(
          `Utils.globToRegex: Failed to convert glob "${glob}" to regex: ${e.message}`
      );
      return null;
    }
  }

  /**
   * A basic security sanitizer for command strings to prevent command substitution.
   * @param {string} input - The command or argument string to sanitize.
   * @param {object} [options={}] - Sanitization options.
   * @param {string} [options.level='command'] - The strictness level ('command', 'arguments', 'full').
   * @param {string[]|null} [options.allowedCommands=null] - A whitelist of commands if level is 'command'.
   * @returns {{isValid: boolean, sanitized: string|null, error: string|null}} A validation result object.
   */
  static sanitizeForExecution(input, options = {}) {
    const {
      level = "command", // "command", "arguments", "full"
      allowedCommands = null,
    } = options;

    if (typeof input !== "string" || !input.trim()) {
      return { isValid: true, sanitized: "", error: null };
    }

    // This is a simplified sanitizer. It primarily blocks backticks for command
    // substitution, as our shell parser does not support them and they represent
    // a common injection vector. Other shell metacharacters like '|', '>', '$', '&&'
    // are handled by our own parser in commexec.js. A more robust solution would
    // avoid regex and use the lexer to validate tokens.
    const backtickPattern = /`.*`/;

    if (backtickPattern.test(input)) {
      return {
        isValid: false,
        sanitized: null,
        error: "Command substitution with backticks (``) is not allowed.",
      };
    }

    // NOTE: Subshells with parentheses '()' are also not supported by our parser.
    // A simple regex check for '(' or ')' would incorrectly flag them inside
    // quoted strings (e.g., echo "hello (world)"). The parser in lexpar.js will
    // correctly throw a syntax error for unsupported subshell syntax, which is sufficient.

    let sanitized = input;

    // Level-specific validation
    switch (level) {
      case "command":
        if (allowedCommands && !allowedCommands.includes(sanitized.split(" ")[0])) {
          return {
            isValid: false,
            sanitized: null,
            error: `Command not allowed: ${sanitized.split(" ")[0]}`,
          };
        }
        break;
      case "arguments":
        // For arguments, we can be a bit stricter, as they shouldn't contain shell operators.
        // We allow '$' for variable expansion but block most other operators.
        const argMetacharacterBlacklist = /[;&|<>`()]/;
        if (argMetacharacterBlacklist.test(input)) {
          return {
            isValid: false,
            sanitized: null,
            error: "Dangerous shell metacharacters are not allowed in arguments.",
          };
        }
        break;
      case "full":
        // This is covered by the main backtick check for now.
        break;
      default:
        return {
          isValid: false,
          sanitized: null,
          error: `Invalid sanitization level: ${level}`,
        };
    }

    return {
      isValid: true,
      sanitized,
      error: null,
    };
  }
}