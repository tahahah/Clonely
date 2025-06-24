import { EventEmitter } from 'events'

/**
 * Finite-state machine for UI flow.
 *
 * Hidden        ── Ctrl+Space ──► ActiveIdle
 * ActiveIdle    ── Ctrl+Space ──► Hidden
 * ActiveIdle    ── Ctrl+Enter  ──► ReadyChat
 * ReadyChat     ── Ctrl+Enter/Submit ─► Loading
 * ReadyChat     ── Esc          ──► ActiveIdle
 * ReadyChat     ── Ctrl+Space   ──► Hidden
 * Loading       ── API_SUCCESS  ──► ReadyChat
 * Loading       ── API_ERROR    ──► Error
 * Loading       ── Esc          ──► ActiveIdle (cancel request)
 * Loading       ── Ctrl+Space   ──► Hidden
 * Error         ── Submit       ──► Loading
 * Error         ── Esc          ──► ActiveIdle
 * Error         ── Ctrl+Space   ──► Hidden
 */

export enum UIState {
  Hidden = 'HIDDEN',
  ActiveIdle = 'ACTIVE_IDLE',
  ReadyChat = 'READY_CHAT',
  Loading = 'LOADING',
  Error = 'ERROR'
}

export type StateEvent =
  | 'TOGGLE_VISIBILITY' // Ctrl+Space
  | 'OPEN_CHAT' // Ctrl+Enter from main bar
  | 'SUBMIT' // Enter within chat
  | 'API_SUCCESS'
  | 'API_ERROR'
  | 'ESC' // escape key / shortcut

/**
 * Minimal but robust state machine.
 * Emits `stateChange` events with `{ prev, next }` payloads whenever the state updates.
 */
export class AppStateMachine extends EventEmitter {
  private current: UIState

  constructor(initial: UIState = UIState.ActiveIdle) {
    super()
    this.current = initial
  }

  /** Get current state */
  public get state(): UIState {
    return this.current
  }

  /**
   * Attempt a transition based on a high-level event.
   * Silently ignores invalid transitions.
   */
  public dispatch(event: StateEvent): void {
    const prev = this.current
    const next = this.nextState(prev, event)
    if (next !== prev) {
      this.current = next
      this.emit('stateChange', { prev, next })
    }
  }

  /** Transition table */
  private nextState(current: UIState, event: StateEvent): UIState {
    switch (current) {
      case UIState.Hidden:
        if (event === 'TOGGLE_VISIBILITY') return UIState.ActiveIdle
        return current

      case UIState.ActiveIdle:
        if (event === 'TOGGLE_VISIBILITY') return UIState.Hidden
        if (event === 'OPEN_CHAT') return UIState.ReadyChat
        return current

      case UIState.ReadyChat:
        if (event === 'TOGGLE_VISIBILITY') return UIState.Hidden
        if (event === 'ESC') return UIState.ActiveIdle
        if (event === 'SUBMIT') return UIState.Loading
        return current

      case UIState.Loading:
        if (event === 'TOGGLE_VISIBILITY') return UIState.Hidden
        if (event === 'ESC') return UIState.ActiveIdle
        if (event === 'API_SUCCESS') return UIState.ReadyChat
        if (event === 'API_ERROR') return UIState.Error
        return current

      case UIState.Error:
        if (event === 'TOGGLE_VISIBILITY') return UIState.Hidden
        if (event === 'ESC') return UIState.ActiveIdle
        if (event === 'SUBMIT') return UIState.Loading
        return current
    }
  }
}

export const appState = new AppStateMachine()
