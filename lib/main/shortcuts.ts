import { globalShortcut, app, BrowserWindow } from 'electron'
import { appState, UIState } from '../state/AppStateMachine'

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
      const currentState = appState.state;
      if (currentState === UIState.ActiveIdle) {
        appState.dispatch('OPEN_CHAT');
      } else if (currentState === UIState.ReadyChat || currentState === UIState.Error) {
        appState.dispatch('SUBMIT');
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
