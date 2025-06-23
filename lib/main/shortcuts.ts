import { globalShortcut, app } from "electron"
import { BrowserWindow } from "electron"
import { createChatWindow } from "./app";

export class ShortcutsHelper {
    private mainWindow: BrowserWindow;
    private chatWindow: BrowserWindow | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    public registerGlobalShortcuts(): void {
        // Hide/Show the main window
        globalShortcut.register("CommandOrControl+Space", async () => {
            const mainVisible = this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible();
            const chatVisible = this.chatWindow && !this.chatWindow.isDestroyed() && this.chatWindow.isVisible();

            if (mainVisible || chatVisible) {
                // If either is visible, hide both
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.hide();
                }
                if (this.chatWindow && !this.chatWindow.isDestroyed()) {
                    this.chatWindow.hide();
                }
            } else {
                // If both are hidden, show both
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.show();
                }
                if (this.chatWindow && !this.chatWindow.isDestroyed()) {
                    this.chatWindow.show();
                    this.chatWindow.focus(); // Bring chat window to foreground when shown
                }
            }
        });

        // Open/Focus the chat window
        globalShortcut.register("CommandOrControl+Enter", async () => {
            if (this.mainWindow.isVisible()) {

                
                if (this.chatWindow && !this.chatWindow.isDestroyed()) {
                    this.chatWindow.show(); // Ensure it's visible
                    this.chatWindow.focus(); // Bring it to the foreground
                    
                    console.log("Chat message sent");
                    // TODO: Send message to chat window
                } else {
                    this.chatWindow = createChatWindow();
                    this.chatWindow.on('closed', () => {
                        this.chatWindow = null;
                    });
                }
                this.chatWindow.show();
                this.chatWindow.focus(); // Bring it to the foreground
            }
            });
            
            
            // Destroy the chat window
            globalShortcut.register("Escape", async () => {
                if (this.chatWindow && !this.chatWindow.isDestroyed() && this.chatWindow.isVisible()) {
                    this.chatWindow.destroy();
                    this.chatWindow = null;
                }
            });
            


    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
