// scripts/lexpar.js

/**
 * A simple Enum for the different types of tokens the Lexer can produce.
 * @readonly
 * @enum {string}
 */
const TokenType = {
  WORD: "WORD",
  STRING_DQ: "STRING_DQ",
  STRING_SQ: "STRING_SQ",
  OPERATOR_GT: "OPERATOR_GT",
  OPERATOR_GTGT: "OPERATOR_GTGT",
  OPERATOR_LT: "OPERATOR_LT",
  OPERATOR_PIPE: "OPERATOR_PIPE",
  OPERATOR_SEMICOLON: "OPERATOR_SEMICOLON",
  OPERATOR_BG: "OPERATOR_BG",
  OPERATOR_AND: "OPERATOR_AND",
  OPERATOR_OR: "OPERATOR_OR",
  EOF: "EOF",
};

/**
 * Represents a single token found by the Lexer.
 * @class Token
 */
class Token {
  /**
   * @constructor
   * @param {TokenType} type - The type of the token.
   * @param {string} value - The raw string value of the token.
   * @param {number} position - The starting position of the token in the input string.
   */
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }
}

/**
 * The Lexer breaks a raw command string into a stream of meaningful tokens.
 * This is the first step in the parsing process.
 * @class Lexer
 */
class Lexer {
  /**
   * @constructor
   * @param {string} input - The raw command line string.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(input, dependencies) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
    this.dependencies = dependencies;
  }

  /**
   * Tokenizes the entire input string and returns an array of tokens.
   * It's like breaking a script down into individual words and actions.
   * @returns {Token[]} The array of tokens.
   */
  tokenize() {
    const specialChars = ['"', "'", ">", "<", "|", "&", ";"];
    while (this.position < this.input.length) {
      let char = this.input[this.position];
      if (/\s/.test(char)) {
        this.position++;
        continue;
      }
      if (char === '"') {
        this.tokens.push(this._tokenizeString('"'));
        continue;
      }
      if (char === "'") {
        this.tokens.push(this._tokenizeString("'"));
        continue;
      }
      if (char === ">") {
        if (this.input[this.position + 1] === ">") {
          this.tokens.push(
              new Token(TokenType.OPERATOR_GTGT, ">>", this.position)
          );
          this.position += 2;
        } else {
          this.tokens.push(
              new Token(TokenType.OPERATOR_GT, ">", this.position)
          );
          this.position++;
        }
        continue;
      }
      if (char === "<") {
        this.tokens.push(new Token(TokenType.OPERATOR_LT, "<", this.position));
        this.position++;
        continue;
      }
      if (char === "|") {
        if (this.input[this.position + 1] === "|") {
          this.tokens.push(
              new Token(TokenType.OPERATOR_OR, "||", this.position)
          );
          this.position += 2;
        } else {
          this.tokens.push(
              new Token(TokenType.OPERATOR_PIPE, "|", this.position)
          );
          this.position++;
        }
        continue;
      }
      if (char === ";") {
        this.tokens.push(
            new Token(TokenType.OPERATOR_SEMICOLON, ";", this.position)
        );
        this.position++;
        continue;
      }
      if (char === "&") {
        if (this.input[this.position + 1] === "&") {
          this.tokens.push(
              new Token(TokenType.OPERATOR_AND, "&&", this.position)
          );
          this.position += 2;
        } else {
          this.tokens.push(
              new Token(TokenType.OPERATOR_BG, "&", this.position)
          );
          this.position++;
        }
        continue;
      }

      let value = "";
      const startPos = this.position;
      while (this.position < this.input.length) {
        let innerChar = this.input[this.position];

        if (innerChar === "\\") {
          this.position++;
          if (this.position < this.input.length) {
            value += this.input[this.position];
            this.position++;
          } else {
            value += "\\";
          }
          continue;
        }

        if (/\s/.test(innerChar) || specialChars.includes(innerChar)) {
          break;
        }

        value += innerChar;
        this.position++;
      }

      if (value) {
        this.tokens.push(new Token(TokenType.WORD, value, startPos));
      } else if (
          this.position < this.input.length &&
          !specialChars.includes(this.input[this.position]) &&
          !/\s/.test(this.input[this.position])
      ) {
        throw new Error(
            `Lexer Error: Unhandled character '${this.input[this.position]}' at position ${this.position} after word processing.`
        );
      }
    }
    this.tokens.push(new Token(TokenType.EOF, null, this.position));
    return this.tokens;
  }

  /**
   * Tokenizes a quoted string, handling escaped characters.
   * @private
   * @param {string} quoteChar - The quote character to look for (either "'" or '"').
   * @returns {Token} The string token.
   */
  _tokenizeString(quoteChar) {
    const startPos = this.position;
    let value = "";
    this.position++;

    while (this.position < this.input.length) {
      let char = this.input[this.position];

      if (char === "\\") {
        const nextChar = this.input[this.position + 1];
        if (nextChar === quoteChar || nextChar === "\\") {
          value += nextChar;
          this.position += 2;
        } else {
          value += char;
          this.position++;
        }
      }
      else if (char === quoteChar) {
        this.position++;
        return new Token(
            quoteChar === '"' ? TokenType.STRING_DQ : TokenType.STRING_SQ,
            value,
            startPos
        );
      }
      else {
        value += char;
        this.position++;
      }
    }

    throw new Error(
        `Lexer Error: Unclosed string literal starting at position ${startPos}. Expected closing ${quoteChar}.`
    );
  }
}

/**
 * Represents a single command, separated from a pipeline.
 * @class ParsedCommandSegment
 */
class ParsedCommandSegment {
  /**
   * @constructor
   * @param {string} command - The command name.
   * @param {string[]} args - An array of arguments.
   */
  constructor(command, args) {
    this.command = command;
    this.args = args;
  }
}

/**
 * Represents a command pipeline, which can contain one or more commands,
 * input/output redirection, and can be run in the background.
 * @class ParsedPipeline
 */
class ParsedPipeline {
  /**
   * @constructor
   */
  constructor() {
    /** @type {ParsedCommandSegment[]} */
    this.segments = [];
    /** @type {object|null} */
    this.redirection = null;
    /** @type {string|null} */
    this.inputRedirectFile = null;
    /** @type {boolean} */
    this.isBackground = false;
    /** @type {number|null} */
    this.jobId = null;
  }
}

/**
 * The Parser takes a stream of tokens from the Lexer and builds an
 * Abstract Syntax Tree (AST) representing the command line structure.
 * @class Parser
 */
class Parser {
  /**
   * @constructor
   * @param {Token[]} tokens - The array of tokens from the Lexer.
   * @param {object} dependencies - The dependency injection container.
   */
  constructor(tokens, dependencies) {
    this.tokens = tokens;
    this.position = 0;
    this.dependencies = dependencies;
  }

  /**
   * Gets the current token without advancing the position.
   * @private
   * @returns {Token} The current token.
   */
  _currentToken() {
    return this.tokens[this.position];
  }

  /**
   * Advances the parser to the next token.
   * @private
   * @returns {Token} The next token.
   */
  _nextToken() {
    if (this.position < this.tokens.length - 1) {
      this.position++;
    }
    return this._currentToken();
  }

  /**
   * Checks if the current token is of the expected type and consumes it.
   * Throws an error if the type doesn't match and the token is not optional.
   * @private
   * @param {TokenType} tokenType - The expected token type.
   * @param {boolean} [optional=false] - If the token is optional.
   * @returns {Token|null} The consumed token or null if it was optional and not found.
   */
  _expectAndConsume(tokenType, optional = false) {
    const current = this._currentToken();
    if (current.type === tokenType) {
      this._nextToken();
      return current;
    }
    if (optional) {
      return null;
    }
    throw new Error(
        `Parser Error: Expected token ${tokenType} but got ${current.type} ('${current.value}') at input position ${current.position}.`
    );
  }

  /**
   * Parses a single command segment within a pipeline.
   * @private
   * @returns {ParsedCommandSegment|null} The parsed command segment or null if no command is found.
   */
  _parseSingleCommandSegment() {
    const terminators = [
      TokenType.EOF,
      TokenType.OPERATOR_PIPE,
      TokenType.OPERATOR_SEMICOLON,
      TokenType.OPERATOR_BG,
      TokenType.OPERATOR_AND,
      TokenType.OPERATOR_OR,
      TokenType.OPERATOR_GT,
      TokenType.OPERATOR_GTGT,
      TokenType.OPERATOR_LT,
    ];
    if (terminators.includes(this._currentToken().type)) {
      return null;
    }
    const cmdToken = this._expectAndConsume(TokenType.WORD);
    const command = cmdToken.value;
    const args = [];
    while (!terminators.includes(this._currentToken().type)) {
      const argToken = this._currentToken();
      if (argToken.type === TokenType.WORD) {
        const globPattern = argToken.value;
        const { FileSystemManager, Utils } = this.dependencies;
        if (globPattern.includes("*") || globPattern.includes("?")) {
          const lastSlashIndex = globPattern.lastIndexOf("/");
          const pathPrefix =
              lastSlashIndex > -1
                  ? globPattern.substring(0, lastSlashIndex + 1)
                  : ".";
          const patternPart =
              lastSlashIndex > -1
                  ? globPattern.substring(lastSlashIndex + 1)
                  : globPattern;

          const searchDir =
              pathPrefix === "/"
                  ? "/"
                  : FileSystemManager.getAbsolutePath(
                      pathPrefix,
                      FileSystemManager.getCurrentPath()
                  );
          const dirNode = FileSystemManager.getNodeByPath(searchDir);

          if (dirNode && dirNode.type === "directory") {
            const regex = Utils.globToRegex(patternPart);
            if (regex) {
              const matches = Object.keys(dirNode.children).filter((name) =>
                  regex.test(name)
              );
              if (matches.length > 0) {
                args.push(
                    ...matches.map((name) =>
                        pathPrefix === "." ? name : `${pathPrefix}${name}`
                    )
                );
              } else {
                args.push(globPattern);
              }
            } else {
              args.push(globPattern);
            }
          } else {
            args.push(globPattern);
          }
        } else {
          args.push(globPattern);
        }
        this._nextToken();
      } else if (
          argToken.type === TokenType.STRING_DQ ||
          argToken.type === TokenType.STRING_SQ
      ) {
        args.push(argToken.value);
        this._nextToken();
      } else {
        throw new Error(
            `Parser Error: Unexpected token ${argToken.type} ('${argToken.value}') in arguments at position ${argToken.position}. Expected WORD or STRING.`
        );
      }
    }
    return new ParsedCommandSegment(command, args);
  }

  /**
   * Parses a single pipeline, which may consist of one or more command segments
   * connected by pipes, along with any I/O redirection.
   * @private
   * @returns {ParsedPipeline|null} The parsed pipeline or null.
   */
  _parseSinglePipeline() {
    const pipeline = new ParsedPipeline();

    if (this._currentToken().type === TokenType.OPERATOR_LT) {
      this._nextToken();
      const fileToken =
          this._expectAndConsume(TokenType.WORD, true) ||
          this._expectAndConsume(TokenType.STRING_DQ, true) ||
          this._expectAndConsume(TokenType.STRING_SQ, true);
      if (!fileToken) {
        throw new Error(
            "Parser Error: Expected filename after input redirection operator '<'."
        );
      }
      pipeline.inputRedirectFile = fileToken.value;
    }

    let currentSegment = this._parseSingleCommandSegment();
    if (currentSegment) {
      pipeline.segments.push(currentSegment);
    }

    while (this._currentToken().type === TokenType.OPERATOR_PIPE) {
      this._nextToken();
      currentSegment = this._parseSingleCommandSegment();
      if (!currentSegment) {
        throw new Error(
            "Parser Error: Expected command after pipe operator '|'."
        );
      }
      pipeline.segments.push(currentSegment);
    }

    if (
        this._currentToken().type === TokenType.OPERATOR_GT ||
        this._currentToken().type === TokenType.OPERATOR_GTGT
    ) {
      const opToken = this._currentToken();
      this._nextToken();
      const fileToken =
          this._expectAndConsume(TokenType.WORD, true) ||
          this._expectAndConsume(TokenType.STRING_DQ, true) ||
          this._expectAndConsume(TokenType.STRING_SQ, true);
      if (!fileToken) {
        throw new Error(
            `Parser Error: Expected filename after redirection operator '${opToken.value}'.`
        );
      }
      pipeline.redirection = {
        type: opToken.type === TokenType.OPERATOR_GTGT ? "append" : "overwrite",
        file: fileToken.value,
      };
    }

    return pipeline.segments.length > 0 ||
    pipeline.redirection ||
    pipeline.inputRedirectFile
        ? pipeline
        : null;
  }

  /**
   * Parses the entire token stream into a sequence of pipelines.
   * This is the entry point for turning the tokenized script into a coherent narrative.
   * @returns {object[]} An array of objects representing the full command sequence.
   */
  parse() {
    const commandSequence = [];
    while (this._currentToken().type !== TokenType.EOF) {
      const pipeline = this._parseSinglePipeline();

      if (!pipeline) {
        if (
            ![
              TokenType.EOF,
              TokenType.OPERATOR_SEMICOLON,
              TokenType.OPERATOR_BG,
              TokenType.OPERATOR_AND,
              TokenType.OPERATOR_OR,
            ].includes(this._currentToken().type)
        ) {
          throw new Error(
              `Parser Error: Unexpected token '${this._currentToken().value}' at start of command.`
          );
        }
        break;
      }

      let operator = null;
      const currentToken = this._currentToken();
      if (
          [
            TokenType.OPERATOR_AND,
            TokenType.OPERATOR_OR,
            TokenType.OPERATOR_SEMICOLON,
            TokenType.OPERATOR_BG,
          ].includes(currentToken.type)
      ) {
        operator = currentToken.value;
        this._nextToken();
      }

      commandSequence.push({ pipeline, operator });

      if (
          this._currentToken().type === TokenType.EOF &&
          (operator === "&&" || operator === "||")
      ) {
        throw new Error(
            `Parser Error: Command expected after '${operator}' operator.`
        );
      }
    }
    this._expectAndConsume(TokenType.EOF);
    return commandSequence;
  }
}