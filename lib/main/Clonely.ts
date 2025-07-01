import { app, BrowserWindow, protocol } from 'electron'
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



    })
  }
}
