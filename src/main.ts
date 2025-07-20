import { app, BrowserWindow, ipcMain, globalShortcut, screen } from "electron";
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { usePluginManager } from "./core/plugin-manager";
import { useResultManager } from "./core/result-manager";
const pluginManager = usePluginManager();
const resultManager = useResultManager();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

function handleResizeWindow(event: any, height: number) {
    const webContents = event.sender;
    const mainWindow = BrowserWindow.fromWebContents(webContents);
    if (mainWindow) {
        mainWindow.setSize(600, height);
    }
}

const createWindow = () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const mainWinWidth = 600;
    const mainWinHeight = 120;
    // const mainWinHeight = 300;

    const x = Math.round((screenWidth - mainWinWidth) / 2);
    const y = Math.round(screenHeight / 4);

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: mainWinWidth,
        height: mainWinHeight,
        frame: false, // Remove a borda e o topo
        transparent: true, // Deixa o fundo transparente
        backgroundColor: "#00FFFFFF",
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // Set the position of the window
    mainWindow.setBounds({ x, y, width: mainWinWidth, height: mainWinHeight });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    // Open the DevTools.
      mainWindow.webContents.openDevTools();

    mainWindow.on("blur", () => {
        mainWindow.hide();
    });

    globalShortcut.register("CommandOrControl+Space", () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
            return;
        }

        mainWindow.show();
        // mainWindow.send("showing-window");
    });
};


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    await pluginManager.loadInternalPlugins(["window-list"]);

    // Plugins externos do usuário (~/.config/central-flow/plugins)
    // const userPluginDir = path.join(process.env.HOME || "", ".config", "central-flow", "plugins");
    // pluginManager.loadExternalPlugins(userPluginDir);

    ipcMain.handle("search", async (_, query: string) => {
        console.log("Managing search for query:", query);

        return await resultManager.search(query);
    });

    ipcMain.handle("execute-action", async (_, resultId: string) => {
        return await resultManager.execute(resultId);
    });

    ipcMain.on("resize-window", handleResizeWindow);

    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
