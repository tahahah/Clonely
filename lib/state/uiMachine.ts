import { createMachine, assign } from 'xstate'


/**
 * Central UI & mode state machine
 * --------------------------------------------------
 * This machine supersedes the old AppStateMachine class.
 * It models the top-level UI states (activeIdle, chat, live)
 * and their nested substates using XState. All visual flags,
 * side-effects, and guards are expressed declaratively so that
 * React components can ctors.
 */

// ---------- Context & Event Types ---------- //
export interface UIContext {
  pendingRequestId?: string // chat request tracking for cancellation
  micCooldown: boolean
  error: string | null
}

export type UIEvent =
  | { type: 'OPEN_CHAT' }
  | { type: 'SUBMIT'; value: string }
  | { type: 'ESC' }
  | { type: 'MIC_START' }
  | { type: 'MIC_STOP' }
  | { type: 'API_SUCCESS'; data: unknown }
  | { type: 'API_ERROR'; error: unknown }
  | { type: 'LIVE_READY' }
  | { type: 'LIVE_ERROR'; error: unknown }
  | { type: 'CLEAR_COOLDOWN' }

// ---------- Services ---------- //


// ---------- Helper guards/actions ---------- //
const hasInput = ({ event }: { event: UIEvent }) => {
    if (event.type === 'SUBMIT') {
    // eslint-disable-next-line no-console
        console.log('[hasInput] input value:', event.value);
        return event.value.trim().length > 0;
  }
  return false;
}
const canStartLive = ({ context }: { context: UIContext }) => !context.micCooldown

const setCooldown = assign({ micCooldown: true })
const clearCooldown = assign({ micCooldown: false })
const clearError = assign({ error: null })

const setError = assign({
  error: ({ event }) => {
    if (event.type === 'API_ERROR' || event.type === 'LIVE_ERROR') {
      return String(event.error) || 'An unknown error occurred.'
    }
    return 'An unknown error occurred.'
  }
})



const startLiveService = () => {
  (window as any).api.send('live-audio-start');
  // Main process will emit 'live-audio-ready' which the provider maps to a LIVE_READY event
}


const stopLiveService = () => {
  (window as any).api.send('live-audio-stop');
}

const sendChat = ({ event }: { event: UIEvent }) => {
    if (event.type !== 'SUBMIT') return;
    const msg = event.value.trim();
  if (!msg) return;
  (window as any).api.send('chat:submit', msg);
};

const cancelChat = () => {
  (window as any).api.send('chat:cancel');
}



// ---------- Machine Definition ---------- //
export const uiMachine = createMachine<UIContext, UIEvent>(
  {
    id: 'ui',
    initial: 'activeIdle',
    context: {
      micCooldown: false,
      error: null
    },
    on: {
      CLEAR_COOLDOWN: {
        actions: clearCooldown
      }
    },
    states: {
      activeIdle: {
        on: {
          OPEN_CHAT: {
            target: 'chat.idle'
          },
          MIC_START: {
            target: 'live.loading',
            guard: 'canStartLive',
            actions: [setCooldown]
          }
        }
      },

      chat: {
        initial: 'idle',
        states: {
          idle: {
            entry: [clearError],
            on: {
              SUBMIT: {
                target: 'loading',
                guard: 'hasInput'
              },
              MIC_START: {
                target: '#ui.live.loading',
                guard: 'canStartLive',
                actions: ['startLiveService', setCooldown, clearError]
              },
              ESC: {
                target: '#ui.activeIdle'
              }
            }
          },
          loading: {
            entry: [clearError, 'sendChat'],
            on: {
              API_SUCCESS: {
                target: 'idle'
              },
              API_ERROR: {
                target: 'error',
                actions: [setError]
              },
              ESC: {
                target: '#ui.activeIdle',
                actions: ['cancelChat']
              }
            }
          },
          error: {
            on: {
              SUBMIT: {
                target: 'loading',
                actions: [clearError]
              },
              MIC_START: {
                target: '#ui.live.loading',
                guard: 'canStartLive',
                actions: [setCooldown]
              },
              ESC: {
                target: '#ui.activeIdle',
                actions: [clearError]
              }
            }
          }
        },
        on: {
          ESC: '#ui.activeIdle' // bubble for all substates not overridden
        }
      },

      live: {
        initial: 'loading',
        on: {
          MIC_STOP: {
            target: 'chat.idle',
            actions: 'stopLiveService'
          },
          ESC: {
            target: 'chat.idle',
            actions: 'stopLiveService'
          }
        },
        states: {
          loading: {
            entry: ['startLiveService', setCooldown, clearError, 'disableMicTemporarily'],
            on: {
              LIVE_READY: 'streaming',
              LIVE_ERROR: {
                target: 'error',
                actions: setError
              }
            }
          },
          streaming: {
            on: {
              LIVE_ERROR: {
                target: 'error',
                actions: setError
              }
            }
          },
          error: {
            on: {}
          }
        }
      }
    }
  },
  {
    guards: {
      canStartLive,
      '#ui.canStartLive': canStartLive,
      hasInput
    },
    
    actions: {
      startLiveService,
      stopLiveService,
      sendChat,
      cancelChat,
      disableMicTemporarily: (_ctx, _evt, { actor }) => {
        // This action is called on entry to live.loading
        // The micCooldown context is set by the 'setCooldown' action on the transition to live.loading
        // We clear the cooldown after a delay
        setTimeout(() => {
          actor.send({ type: 'CLEAR_COOLDOWN' })
        }, 1200) // 1.2s cooldown
      }
    }
  }
)


