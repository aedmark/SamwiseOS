// scripts/commands/ocrypt.js

/**
 * @fileoverview This file defines the 'ocrypt' command, a secure utility for
 * encrypting and decrypting files using the Web Cryptography API with AES-GCM.
 * @module commands/ocrypt
 */

/**
 * A utility for encrypting and decrypting files using the Web Cryptography API with AES-GCM.
 * This is a secure, modern implementation intended for robust data protection.
 *
 * @class OcryptCommand
 * @extends Command
 */
window.OcryptCommand = class OcryptCommand extends Command {
  /**
   * @constructor
   */
  constructor() {
    super({
      commandName: "ocrypt",
      description: "Encrypts or decrypts files using a secure AES-GCM cipher.",
      helpText: `Usage: ocrypt [-d] <key> <inputfile> [outputfile]
      Securely encrypt or decrypt a file using a key.

      DESCRIPTION
      ocrypt is a powerful cryptographic tool that uses the browser's built-in
      Web Cryptography API. It employs the AES-GCM standard, providing both
      confidentiality and integrity for your data.

      The command uses a key derivation function (PBKDF2) with a unique salt
      for each encryption, meaning the same password will produce different
      ciphertext each time, enhancing security.

      The encrypted output is a single text block containing the salt,
      initialization vector (IV), and the ciphertext, separated by periods.

      OPTIONS
      -d, --decrypt
      Decrypt the input file instead of encrypting.

      WARNING
      While this tool uses strong, standardized cryptography, always ensure
      you use a strong, unique key for sensitive data. Forgetting the key
      will result in permanent data loss.`,
      flagDefinitions: [
        { name: "decrypt", short: "-d", long: "--decrypt" },
      ],
      validations: {
        args: { min: 2, max: 3, error: "Usage: ocrypt [-d] <key> <inputfile> [outputfile]" },
        paths: [{
          argIndex: 1,
          options: { expectedType: 'file', permissions: ['read'] }
        }]
      },
    });
  }

  /**
   * Derives a cryptographic key from a password string and a salt using PBKDF2.
   * @param {string} password - The user-provided secret key.
   * @param {Uint8Array} salt - A random salt.
   * @returns {Promise<CryptoKey>} A promise that resolves to the derived CryptoKey.
   * @private
   */
  async _getKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypts data using AES-GCM.
   * @param {string} keyString - The password to derive the key from.
   * @param {string} data - The plaintext data to encrypt.
   * @returns {Promise<string>} A promise that resolves to the encrypted string (salt.iv.ciphertext).
   * @private
   */
  async _encrypt(keyString, data) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this._getKey(keyString, salt);
    const enc = new TextEncoder();

    const encryptedContent = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(data)
    );

    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const ciphertextHex = Array.from(new Uint8Array(encryptedContent)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${saltHex}.${ivHex}.${ciphertextHex}`;
  }

  /**
   * Decrypts data using AES-GCM.
   * @param {string} keyString - The password to derive the key from.
   * @param {string} encryptedData - The encrypted string (salt.iv.ciphertext).
   * @returns {Promise<string>} A promise that resolves to the decrypted plaintext.
   * @private
   */
  async _decrypt(keyString, encryptedData) {
    const parts = encryptedData.split('.');
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format. Expected salt.iv.ciphertext");
    }

    const salt = new Uint8Array(parts[0].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const iv = new Uint8Array(parts[1].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(parts[2].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const key = await this._getKey(keyString, salt);
    const dec = new TextDecoder();

    try {
      const decryptedContent = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          key,
          ciphertext
      );
      return dec.decode(decryptedContent);
    } catch (e) {
      throw new Error("Decryption failed. The key is incorrect or the data has been tampered with.");
    }
  }

  /**
   * Executes the core logic for the ocrypt command.
   * It determines whether to encrypt or decrypt based on the '-d' flag,
   * performs the cryptographic operation, and then either prints the result
   * to standard output or saves it to a specified output file.
   * @param {object} context - The command execution context.
   * @returns {Promise<object>} The result of the command execution.
   */
  async coreLogic(context) {
    const { args, flags, currentUser, validatedPaths, dependencies } = context;
    const { FileSystemManager, UserManager, ErrorHandler, OutputManager } = dependencies;

    const key = args[0];
    const inputFileNode = validatedPaths[0].node;
    const outputFile = args.length === 3 ? args[2] : null;
    const inputContent = inputFileNode.content || "";

    try {
      let outputContent;
      if (flags.decrypt) {
        await OutputManager.appendToOutput("Decrypting file...");
        outputContent = await this._decrypt(key, inputContent);
      } else {
        await OutputManager.appendToOutput("Encrypting file...");
        outputContent = await this._encrypt(key, inputContent);
      }

      if (outputFile) {
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            outputFile,
            outputContent,
            { currentUser, primaryGroup }
        );

        if (!saveResult.success) {
          return ErrorHandler.createError({ message: `ocrypt: ${saveResult.error}` });
        }
        return ErrorHandler.createSuccess("", { stateModified: true });
      } else {
        return ErrorHandler.createSuccess(outputContent);
      }
    } catch (e) {
      return ErrorHandler.createError({ message: `ocrypt: ${e.message}` });
    }
  }
}

window.CommandRegistry.register(new OcryptCommand());