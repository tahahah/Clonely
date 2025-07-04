import { EventEmitter } from 'events'

/**
 * Finite-state machine for UI flow.
 *
 * ActiveIdle    ── Ctrl+Enter  ──► ReadyChat
 * ReadyChat     ── Ctrl+Enter/Submit ─► Loading
 * ReadyChat     ── Esc          ──► ActiveIdle
 * Loading       ── API_SUCCESS  ──► ReadyChat
 * Loading       ── API_ERROR    ──► Error
 * Loading       ── Esc          ──► ActiveIdle (cancel request)
 * Error         ── Submit       ──► Loading
 * Error         ── Esc          ──► ActiveIdle
 */

export enum UIState {
  ActiveIdle = 'ACTIVE_IDLE',
  ReadyChat = 'READY_CHAT',
  Loading = 'LOADING',
  Error = 'ERROR'
}

export type StateEvent =
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

      case UIState.ActiveIdle:
         if (event === 'OPEN_CHAT') return UIState.ReadyChat
         return current

      case UIState.ReadyChat:
         if (event === 'ESC') return UIState.ActiveIdle
         if (event === 'SUBMIT') return UIState.Loading
         return current

      case UIState.Loading:
         if (event === 'ESC') return UIState.ActiveIdle
         if (event === 'API_SUCCESS') return UIState.ReadyChat
         if (event === 'API_ERROR') return UIState.Error
         return current

      case UIState.Error:
         if (event === 'ESC') return UIState.ActiveIdle
         if (event === 'SUBMIT') return UIState.Loading
         return current
    }
  }
}

export const appState = new AppStateMachine()
