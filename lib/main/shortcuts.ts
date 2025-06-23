import { globalShortcut, app } from "electron"
import { BrowserWindow } from "electron"

export class ShortcutsHelper {
    private mainWindow: BrowserWindow; // Add this property

    constructor(mainWindow: BrowserWindow) { // Add a constructor to receive the mainWindow
        this.mainWindow = mainWindow;
    }


  public registerGlobalShortcuts(): void {
    // Minimize the window
    globalShortcut.register("CommandOrControl+Space", async () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            } else {
                this.mainWindow.minimize();
            }
        }
    })


    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
