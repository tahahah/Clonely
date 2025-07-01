import { app, BrowserWindow, screen, desktopCapturer, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { registerIpcHandlers } from './ipc/router'
import { UIState, appState } from '../state/AppStateMachine'
import { GeminiHelper } from '../llm/GeminiHelper'
import { LiveAudioService } from '../features/live-audio/LiveAudioService'
import { ShortcutsHelper } from './shortcuts'
import { windowRegistry } from './windowRegistry'
import { join } from 'path'

function registerResourcesProtocol() {
  protocol.registerFileProtocol('resources', (request, callback) => {
    const url = request.url.replace(/^resources:\/\//, '')
        const absolutePath = join(__dirname, '..', '..', 'resources', url)
    callback({ path: absolutePath })
  })
}

/**
 * The main application class for Clonely.
 * This class encapsulates the application's lifecycle, state management,
 * window creation, and IPC handling.
 */
export class ClonelyApp {
  // =========================================================================================
  // Properties
  // =========================================================================================

  // --- App State ---
  private isInvisible = false
  private currentInputValue = ''
  private apiRequestController: AbortController | null = null

  // --- Windows ---
  private mainWindow!: BrowserWindow

  // --- Services ---
  private liveAudioService: LiveAudioService
  private shortcutsHelper!: ShortcutsHelper
  private geminiHelper: GeminiHelper

  // =========================================================================================
  // Lifecycle
  // =========================================================================================

  /**
   * Initializes the application by creating services and attaching app events.
   */
  constructor() {

    this.liveAudioService = new LiveAudioService()
    this.geminiHelper = new GeminiHelper()
    this._attachAppEvents()
    app.disableHardwareAcceleration()
  }

  /**
   * Attaches the core Electron app lifecycle events.
   */
  private _attachAppEvents(): void {
    app.whenReady().then(() => this._onReady())

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createAppWindow(this.isInvisible)
      }
    })
  }

  /**
   * Runs when the Electron app is ready. Initializes windows, services, and handlers.
   */
  private _onReady(): void {

    electronApp.setAppUserModelId('com.taha')
    registerResourcesProtocol()

    // Create window and helper now that app is ready
    this.mainWindow = createAppWindow(this.isInvisible)


    this.shortcutsHelper = new ShortcutsHelper(this.mainWindow)

    windowRegistry.setMainWindow(this.mainWindow)

    this._registerIpcHandlers()
    this._registerStateMachineHandlers()

    this.shortcutsHelper.registerGlobalShortcuts()
    ;(global as any).appState = appState

    this.mainWindow.webContents.on('did-finish-load', () => {

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('invisibility-state-changed', this.isInvisible)
      }
    })
  }

  // =========================================================================================
  // IPC and State Management
  // =========================================================================================

  /**
   * Registers all IPC handlers for the application.
   * This centralizes the communication between the main and renderer processes.
   */
  private _registerIpcHandlers(): void {
    registerIpcHandlers({
      liveAudioService: this.liveAudioService,
      shortcutsHelper: this.shortcutsHelper,
      createAppWindow,
      getMainWindow: () => this.mainWindow,
      setMainWindow: (win: BrowserWindow) => {
        this.mainWindow = win
        windowRegistry.setMainWindow(win)
      },
      getIsInvisible: () => this.isInvisible,
      setIsInvisible: (val: boolean) => {
        this.isInvisible = val
      },
      setCurrentInputValue: (val: string) => {
        this.currentInputValue = val
      }
    })
  }

  /**
   * Registers the main state machine handler.
   * This method listens for state changes and orchestrates the application's response,
   * such as handling API requests and managing the chat window.
   */
  private _registerStateMachineHandlers(): void {
    appState.on('stateChange', async ({ prev, next }) => {

      // If a live session is active and user submits text -> send via live session.
      if (next === UIState.Loading && this.liveAudioService.isActive()) {
        if (this.currentInputValue.trim()) {
          this.liveAudioService.sendTextInput(this.currentInputValue.trim())
        }
        appState.dispatch('API_SUCCESS')
        return
      }

      // Reset chat history when returning to idle
      if (next === UIState.ActiveIdle) {
        this.geminiHelper.resetChat()
      }

      // Cancel any API request if we are moving away from the Loading state
      if (prev === UIState.Loading && next !== UIState.Loading) {
        this.apiRequestController?.abort()
        this.apiRequestController = null
      }

      // Broadcast the state change to all windows
      windowRegistry.broadcast('state-changed', { prev, next })

      // Handle API requests and window management based on state
      if (next === UIState.Loading) {
        this.apiRequestController = new AbortController()
        await this._handleApiRequest(this.apiRequestController.signal)
      }

      this._manageChatPaneVisibility(next)
    })
  }

  /**
   * Handles the logic for making an API request to Gemini, including screen capture.
   * It captures the primary screen, sends it along with the user's input to the Gemini API,
   * and streams the response back to the UI.
   * @param signal - An AbortSignal to cancel the request if the state changes.
   */
  private async _handleApiRequest(signal: AbortSignal): Promise<void> {
    try {
      // --- Capture Phase ---
      const primaryDisplay = screen.getPrimaryDisplay()
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: primaryDisplay.size
      })
      const primaryScreenSource =
        sources.find((source) => source.display_id === String(primaryDisplay.id)) || sources[0]

      if (!primaryScreenSource) {
        throw new Error('Could not find primary screen source for screenshot.')
      }

      const screenshotPng = primaryScreenSource.thumbnail.toPNG()

      if (!screenshotPng || screenshotPng.length === 0) {
        throw new Error('Failed to capture screenshot.')
      }

      const screenshotBase64 = screenshotPng.toString('base64')

      // --- API Call Phase ---
      const onChunk = (chunk: string): void => {
        if (!signal.aborted) {
          windowRegistry.broadcast('api-stream-chunk', { text: chunk })
        }
      }

      await this.geminiHelper.sendMessageStream(this.currentInputValue, onChunk, signal, screenshotBase64)

      if (!signal.aborted) {
        appState.dispatch('API_SUCCESS')
      }
    } catch (error) {
      if (signal.aborted) {
        console.error('[API] Request was aborted by state change.')
      } else {
        console.error('[API] Request failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        windowRegistry.broadcast('api-error', errorMessage)
        appState.dispatch('API_ERROR')
      }
    } finally {
      if (this.apiRequestController?.signal === signal) {
        this.apiRequestController = null
      }
    }
  }

  /**
   * Manages the lifecycle of the chat window based on the application state.
   * It creates the window when needed (e.g., for chat or loading states) and
   * destroys it when it's no longer required.
   * @param state - The current UIState which determines if the window should exist.
   */
  private _manageChatPaneVisibility(state: UIState): void {
    const shouldChatPaneBeVisible = [UIState.ReadyChat, UIState.Loading, UIState.Error].includes(
      state
    )

    windowRegistry.broadcast('ui:set-chat-pane-visibility', shouldChatPaneBeVisible)

    // When chat pane is hidden, clear the input value
    if (!shouldChatPaneBeVisible) {
      this.currentInputValue = ''
    }
  }
}
