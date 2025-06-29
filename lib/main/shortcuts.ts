import { globalShortcut, app, BrowserWindow } from 'electron'
import { appState, UIState } from '../state/AppStateMachine'

/**
 * Handles registration of global keyboard shortcuts.
 * This class only dispatches events to the state machine and does not
 * perform any window manipulations directly.
 */
export class ShortcutsHelper {
  constructor(
    private mainWindow: BrowserWindow,
    private getChatWindow: () => BrowserWindow | null
  ) {}

  public updateMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  public registerGlobalShortcuts(): void {
    // Ctrl+Space always listens globally
    globalShortcut.register('CommandOrControl+Space', () => {
      const chatWindow = this.getChatWindow();
      const anyVisible =
        (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) ||
        (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible());

      if (anyVisible) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.hide();
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
        // Unregister other shortcuts
        this.unregisterWindowShortcuts();
      } else {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.show();
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.show();
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.focus();
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
      const chatWindow = this.getChatWindow();
      if (this.mainWindow.isVisible()) {
        if (chatWindow && !chatWindow.isDestroyed() && !chatWindow.isFocused()) {
          chatWindow.show();
        } else {
          const currentState = appState.state;
          if (currentState === UIState.ActiveIdle) {
            appState.dispatch('OPEN_CHAT');
          } else if (
            currentState === UIState.ReadyChat ||
            currentState === UIState.Error
          ) {
            appState.dispatch('SUBMIT');
          }
        }
      }
    });

    // Escape: send ESC to state machine
    globalShortcut.register('Escape', () => {
      appState.dispatch('ESC');
    });
  }

  // Unregister window-specific shortcuts
  private unregisterWindowShortcuts(): void {
    globalShortcut.unregister('CommandOrControl+Enter');
    globalShortcut.unregister('Escape');
  }
}
