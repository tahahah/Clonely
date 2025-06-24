import { globalShortcut, app } from 'electron'
import { appState, UIState } from '../state/AppStateMachine'

/**
 * Handles registration of global keyboard shortcuts.
 * This class only dispatches events to the state machine and does not
 * perform any window manipulations directly.
 */
export class ShortcutsHelper {
  public registerGlobalShortcuts(): void {
    globalShortcut.register('CommandOrControl+Space', () => {
      console.log('[Shortcut] Dispatching TOGGLE_VISIBILITY')
      appState.dispatch('TOGGLE_VISIBILITY')
    })

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
