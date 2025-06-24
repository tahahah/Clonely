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

  public registerGlobalShortcuts(): void {
    // Toggle visibility of windows without touching app state
    globalShortcut.register('CommandOrControl+Space', () => {
      const chatWindow = this.getChatWindow()
      const anyVisible =
        (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) ||
        (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible())

      if (anyVisible) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.hide()
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide()
      } else {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.show()
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.show()
        if (chatWindow && !chatWindow.isDestroyed()) chatWindow.focus()
      }
    })

    // Other shortcuts still drive state machine
    globalShortcut.register('CommandOrControl+Enter', () => {
      const currentState = appState.state
      console.log(`[Shortcut] Ctrl+Enter pressed in state: ${currentState}`)

      if (currentState === UIState.ActiveIdle) {
        appState.dispatch('OPEN_CHAT')
      } else if (
        currentState === UIState.ReadyChat ||
        currentState === UIState.Error
      ) {
        appState.dispatch('SUBMIT')
      }
    })

    globalShortcut.register('Escape', () => {
      console.log('[Shortcut] Dispatching ESC')
      appState.dispatch('ESC')
    })

    // Unregister shortcuts when quitting
    app.on('will-quit', () => {
      globalShortcut.unregisterAll()
    })
  }
}
