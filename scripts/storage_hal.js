// scripts/storage_hal.js

/**
 * @abstract
 * @class StorageHAL
 * @classdesc The Storage Hardware Abstraction Layer (HAL) interface.
 * Defines the contract for all storage backends for the FileSystemManager,
 * ensuring a consistent API for saving, loading, and clearing filesystem data.
 */
class StorageHAL {
    constructor() {
        if (this.constructor === StorageHAL) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }
    /**
     * Initializes the storage backend. This method should be called before
     * any other storage operations are performed.
     * @returns {Promise<boolean>} A promise that resolves to true on successful initialization.
     */
    async init() { throw new Error("Method 'init()' must be implemented."); }

    /**
     * Loads the entire filesystem data object from the storage backend.
     * @returns {Promise<object|null>} A promise resolving to the filesystem data object,
     * or null if no data is found or an error occurs.
     */
    async load() { throw new Error("Method 'load()' must be implemented."); }

    /**
     * Saves the entire filesystem data object to the storage backend.
     * @param {object} fsData - The complete filesystem data to save.
     * @returns {Promise<boolean>} A promise that resolves to true on successful save.
     */
    async save(fsData) { throw new Error("Method 'save(fsData)' must be implemented."); }

    /**
     * Clears the entire filesystem storage.
     * @returns {Promise<boolean>} A promise that resolves to true on successful clearing.
     */
    async clear() { throw new Error("Method 'clear()' must be implemented."); }
}

/**
 * @class IndexedDBStorageHAL
 * @classdesc The default storage implementation using IndexedDB for the OopisOS virtual filesystem.
 * @extends StorageHAL
 */
class IndexedDBStorageHAL extends StorageHAL {
    /**
     * Sets the dependency injection container.
     * @param {object} dependencies - The dependencies to be injected.
     */
    setDependencies(dependencies) {
        /**
         * The dependency injection container.
         * @type {object}
         */
        this.dependencies = dependencies;
    }

    /**
     * Initializes the IndexedDB connection via the IndexedDBManager.
     * @returns {Promise<boolean>} A promise that resolves to true on successful connection.
     */
    async init() {
        const { IndexedDBManager, Config, OutputManager } = this.dependencies;
        try {
            /**
             * The active IndexedDB database instance.
             * @type {IDBDatabase}
             */
            this.dbInstance = await IndexedDBManager.init();
            return true;
        } catch (e) {
            const errorMsg = `StorageHAL Error: Could not initialize IndexedDB. Error: ${e.message}.`;
            if (
                typeof OutputManager !== "undefined" &&
                typeof OutputManager.appendToOutput === "function"
            ) {
                await OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                });
            } else {
                console.error(errorMsg);
            }
            return false;
        }
    }

    /**
     * Loads the unified filesystem object from the IndexedDB store.
     * @returns {Promise<object|null>} A promise resolving to the filesystem data object,
     * or null if not found.
     */
    async load() {
        const { Config } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before load.");
            return null;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readonly"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.get(Config.DATABASE.UNIFIED_FS_KEY);
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.data : null);
            };
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * Saves the entire filesystem data object to a single record in IndexedDB.
     * @param {object} fsData - The complete filesystem data to save.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async save(fsData) {
        const { Config, Utils } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before save.");
            return false;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.put({
                id: Config.DATABASE.UNIFIED_FS_KEY,
                data: Utils.deepCopyNode(fsData),
            });
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    /**
     * Clears all data from the filesystem object store in IndexedDB.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async clear() {
        const { Config } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before clear.");
            return false;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }
}

window.IndexedDBStorageHAL = IndexedDBStorageHAL;