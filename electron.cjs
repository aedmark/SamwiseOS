// electron.cjs

/**
 * @file Main process for the OopisOS Electron application.
 * This script handles window creation, application lifecycle events, and
 * IPC communication for native dialogs, ensuring the app runs in a portable manner.
 */

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

/**
 * A boolean that is true if the application is packaged, false otherwise.
 * @type {boolean}
 */
const isPackaged = app.isPackaged;

/**
 * The root directory of the application. Changes based on whether the app is packaged.
 * @type {string}
 */
const rootDir = isPackaged
    ? path.dirname(app.getPath("exe"))
    : app.getAppPath();

/**
 * The path for storing user data, ensuring the application is portable.
 * @type {string}
 */
const portableDataPath = path.join(rootDir, "data");
app.setPath("userData", portableDataPath);

console.log(
    "OopisOS is running in Portable Mode. Data will be stored at:",
    portableDataPath
);

/**
 * Creates and configures the main browser window for the application.
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 960,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname),
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow
      .loadFile(path.join(app.getAppPath(), "index.html"))
      .catch((err) => console.error("Failed to load index.html", err));
}

/**
 * Main application entry point. Sets up IPC handlers and creates the main window
 * once the Electron app is ready.
 */
app.whenReady().then(() => {
  // IPC handler for showing a native "save" dialog.
  ipcMain.handle("dialog:showSaveDialog", async (event, options) => {
    const { filePath } = await dialog.showSaveDialog(options);
    return filePath;
  });

  // IPC handler for showing a native "open" dialog.
  ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
    const { filePaths } = await dialog.showOpenDialog(options);
    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  createWindow();

  // Re-create the window on macOS if the dock icon is clicked and no other windows are open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quits the application when all windows are closed, except on macOS.
 */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});