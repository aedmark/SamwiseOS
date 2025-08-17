// scripts/config.js

class ConfigManager {
    constructor() {
        this.dependencies = {};
        this._initializeDefaultConfig();
    }

    _initializeDefaultConfig() {
        const defaultConfig = {

            DATABASE: {
                NAME: "SamwiseOS",
                VERSION: 3,
                FS_STORE_NAME: "FileSystemsStore",
                UNIFIED_FS_KEY: "SamwiseOS_SharedFS",
            },

            OS: {
                NAME: "SamwiseOS",
                VERSION: "0.0.3",
                DEFAULT_HOST_NAME: "SamwiseOS",
            },

            NETWORKING: {
                NETWORKING_ENABLED: false, // The new master switch!
                SIGNALING_SERVER_URL: 'ws://localhost:8080',
            },

            USER: {
                DEFAULT_NAME: "Guest",
                RESERVED_USERNAMES: ["guest", "root", "admin", "system"],
                MIN_USERNAME_LENGTH: 3,
                MAX_USERNAME_LENGTH: 20,
            },

            SUDO: {
                SUDOERS_PATH: "/etc/sudoers",
                DEFAULT_TIMEOUT: 15,
                AUDIT_LOG_PATH: "/var/log/sudo.log",
            },

            TERMINAL: {
                MAX_HISTORY_SIZE: 50,
                PROMPT_CHAR: ">",
                PROMPT_SEPARATOR: ":",
                PROMPT_AT: "@",
            },

            STORAGE_KEYS: {
                ONBOARDING_COMPLETE: "oopisOsOnboardingComplete",
                USER_CREDENTIALS: "oopisOsUserCredentials",
                USER_TERMINAL_STATE_PREFIX: "oopisOsUserTerminalState_",
                MANUAL_TERMINAL_STATE_PREFIX: "oopisOsManualUserTerminalState_",
                EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
                ALIAS_DEFINITIONS: "oopisOsAliasDefinitions",
                GEMINI_API_KEY: "oopisGeminiApiKey",
                USER_GROUPS: "oopisOsUserGroups",
                LAST_CREATED_USER: "oopisOsLastCreatedUser",
            },

            FILESYSTEM: {
                ROOT_PATH: "/",
                CURRENT_DIR_SYMBOL: ".",
                PARENT_DIR_SYMBOL: "..",
                DEFAULT_DIRECTORY_TYPE: "directory",
                DEFAULT_FILE_TYPE: "file",
                SYMBOLIC_LINK_TYPE: 'symlink',
                PATH_SEPARATOR: "/",
                DEFAULT_FILE_MODE: 0o644,
                DEFAULT_DIR_MODE: 0o755,
                DEFAULT_SCRIPT_MODE: 0o755,
                DEFAULT_SH_MODE: 0o755,
                PERMISSION_BIT_READ: 0b100,
                PERMISSION_BIT_WRITE: 0b010,
                PERMISSION_BIT_EXECUTE: 0b001,
                MAX_VFS_SIZE: 640 * 1024 * 1024,
                MAX_SCRIPT_STEPS: 10000,
                MAX_SCRIPT_DEPTH: 100,
            },

            MESSAGES: {
                AI_LOADING_MESSAGES: [
                    "Analyzing narrative structure...",
                    "Calibrating the irony meter...",
                    "Reticulating splines...",
                    "Consulting the oracle...",
                    "Asking the right questions...",
                    "Brewing coffee for the AI...",
                    "Warming up the neural networks...",
                ],
                PERMISSION_DENIED_SUFFIX: ": You aren't allowed to do that.",
                CONFIRMATION_PROMPT: "Type 'YES' (all caps) if you really wanna go through with this.",
                OPERATION_CANCELLED: "Nevermind.",
                ALREADY_LOGGED_IN_AS_PREFIX: "I'm sure you didn't notice, but, '",
                ALREADY_LOGGED_IN_AS_SUFFIX: "' is already here.",
                NO_ACTION_TAKEN: "I didn't do anything.",
                ALREADY_IN_DIRECTORY_PREFIX: "We're already in '",
                ALREADY_IN_DIRECTORY_SUFFIX: "'.",
                DIRECTORY_EMPTY: "Nothing here",
                TIMESTAMP_UPDATED_PREFIX: "Alibi of '",
                TIMESTAMP_UPDATED_SUFFIX: "' updated.",
                FILE_CREATED_SUFFIX: "' forged.",
                ITEM_REMOVED_SUFFIX: "' destroyed.",
                FORCIBLY_REMOVED_PREFIX: "Decimated '",
                FORCIBLY_REMOVED_SUFFIX: "'.",
                REMOVAL_CANCELLED_PREFIX: "Eradication of '",
                REMOVAL_CANCELLED_SUFFIX: "' cancelled.",
                MOVED_PREFIX: "Moved '",
                MOVED_TO: "' to '",
                MOVED_SUFFIX: "'.",
                COPIED_PREFIX: "Copied '",
                COPIED_TO: "' to '",
                COPIED_SUFFIX: "'.",
                WELCOME_PREFIX: "Greetings and Salutations,",
                WELCOME_SUFFIX: "! Type 'help' for commands.",
                EXPORTING_PREFIX: "Exporting '",
                EXPORTING_SUFFIX: "'... Check your browser downloads.",
                BACKUP_CREATING_PREFIX: "Creating backup '",
                BACKUP_CREATING_SUFFIX: "'... Check your browser downloads.",
                RESTORE_CANCELLED_NO_FILE: "Restore cancelled: No file selected.",
                RESTORE_SUCCESS_PREFIX: "Session for user '",
                RESTORE_SUCCESS_MIDDLE: "' successfully restored from '",
                RESTORE_SUCCESS_SUFFIX: "'.",
                UPLOAD_NO_FILE: "Upload cancelled: No file selected.",
                UPLOAD_INVALID_TYPE_PREFIX: "Error: Invalid file type '",
                UPLOAD_INVALID_TYPE_SUFFIX: "'. Only .txt, .md, .html, .sh, .js, .css, .json files are allowed.",
                UPLOAD_SUCCESS_PREFIX: "File '",
                UPLOAD_SUCCESS_MIDDLE: "' uploaded successfully to '",
                UPLOAD_SUCCESS_SUFFIX: "'.",
                UPLOAD_READ_ERROR_PREFIX: "Error reading file '",
                UPLOAD_READ_ERROR_SUFFIX: "'.",
                NO_COMMANDS_IN_HISTORY: "No commands in history.",
                EDITOR_DISCARD_CONFIRM: "Care to save your work?",
                BACKGROUND_PROCESS_STARTED_PREFIX: "[",
                BACKGROUND_PROCESS_STARTED_SUFFIX: "] Backgrounded.",
                BACKGROUND_PROCESS_OUTPUT_SUPPRESSED: "[Output suppressed for background process]",
                PIPELINE_ERROR_PREFIX: "Pipeline error in command: ",
                PASSWORD_PROMPT: "What's the password?",
                PASSWORD_CONFIRM_PROMPT: "Can you repeat that?",
                PASSWORD_MISMATCH: "You're mixed up, kid. The passwords don't match.",
                INVALID_PASSWORD: "Nope, sorry. Are you sure you typed it right?",
                EMPTY_PASSWORD_NOT_ALLOWED: "No free passes around here, kiddo. You can't use an empty password.",
            },

            INTERNAL_ERRORS: {
                DB_NOT_INITIALIZED_FS_SAVE: "DB not initialized for FS save",
                DB_NOT_INITIALIZED_FS_LOAD: "DB not initialized for FS load",
                DB_NOT_INITIALIZED_FS_DELETE: "DB not initialized for FS delete",
                DB_NOT_INITIALIZED_FS_CLEAR: "DB not initialized for clearing all FS",
                CORRUPTED_FS_DATA_PRE_SAVE: "Corrupted FS data before saving.",
                SOURCE_NOT_FOUND_IN_PARENT_PREFIX: "internal error: source '",
                SOURCE_NOT_FOUND_IN_PARENT_MIDDLE: "' not found in parent '",
                SOURCE_NOT_FOUND_IN_PARENT_SUFFIX: "'",
            },

            API: {
                GEMINI_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                LLM_PROVIDERS: {
                    gemini: {
                        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                        defaultModel: "gemini-2.5-flash",
                    },
                    ollama: {
                        url: "http://localhost:11434/api/generate",
                        defaultModel: "gemma3:latest",
                    },
                },
            },
            COMMANDS_MANIFEST: [],
        };

        Object.assign(this, defaultConfig);

        this.CSS_CLASSES = Object.freeze({
            ERROR_MSG: "text-error",
            SUCCESS_MSG: "text-success",
            CONSOLE_LOG_MSG: "text-subtle",
            WARNING_MSG: "text-warning",
            EDITOR_MSG: "text-info",
            DIR_ITEM: "text-dir",
            FILE_ITEM: "text-file",
            OUTPUT_LINE: "terminal__output-line",
            HIDDEN: "hidden",
        });
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    _parseConfigValue(valueStr) {
        if (typeof valueStr !== "string") return valueStr;
        const lowercasedVal = valueStr.toLowerCase();
        if (lowercasedVal === "true") return true;
        if (lowercasedVal === "false") return false;
        const num = Number(valueStr);
        if (!isNaN(num) && valueStr.trim() !== "") return num;
        return valueStr;
    }

    _setNestedProperty(obj, path, value) {
        const parts = path.split(".");
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts.length - 1] = this._parseConfigValue(value);
    }

    async loadPackageManifest() {
        const { FileSystemManager } = this.dependencies;
        const manifestPath = '/etc/pkg_manifest.json';
        const manifestNode = await FileSystemManager.getNodeByPath(manifestPath);

        if (manifestNode) {
            try {
                const manifest = JSON.parse(manifestNode.content || '{}');
                if (manifest.packages && Array.isArray(manifest.packages)) {
                    manifest.packages.forEach(pkgName => {
                        if (!this.COMMANDS_MANIFEST.includes(pkgName)) {
                            this.COMMANDS_MANIFEST.push(pkgName);
                        }
                    });
                    this.COMMANDS_MANIFEST.sort();
                }
            } catch (e) {
                console.error("Error parsing package manifest:", e);
            }
        }
    }
}