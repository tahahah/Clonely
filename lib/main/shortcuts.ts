import { globalShortcut, app, BrowserWindow } from 'electron'

/**
 * Handles registration of global keyboard shortcuts.
 * This class only dispatches events to the state machine and does not
 * perform any window manipulations directly.
 */
export class ShortcutsHelper {
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  public updateMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  public registerGlobalShortcuts(): void {
    // Ctrl+Space always listens globally
    globalShortcut.register('CommandOrControl+Space', () => {
      const anyVisible =
        (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible());

      if (anyVisible) {
        this.mainWindow.hide();
        // Unregister other shortcuts
        this.unregisterWindowShortcuts();
      } else {
        this.mainWindow.show();
        // Register other shortcuts
        this.registerWindowShortcuts();
      }
    });

    // Initially register window-specific shortcuts
    this.registerWindowShortcuts();

    // Unregister all on quit
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });
  }

  // Register shortcuts only when windows are visible
  private registerWindowShortcuts(): void {
    // Enter: open or submit in chat
    globalShortcut.register('CommandOrControl+Enter', () => {
      this.mainWindow?.webContents.send('shortcut:ctrl-enter');
      if (this.mainWindow?.isVisible()) {
        this.mainWindow?.focus()
      }
    });

    // Escape: send ESC to state machine
    globalShortcut.register('Escape', () => {
      this.mainWindow?.webContents.send('shortcut:esc');
    });
  }

  // Unregister window-specific shortcuts
  private unregisterWindowShortcuts(): void {
    globalShortcut.unregister('CommandOrControl+Enter');
    globalShortcut.unregister('Escape');
  }
}
