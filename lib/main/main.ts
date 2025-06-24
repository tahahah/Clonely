import { app, BrowserWindow, ipcMain, protocol, desktopCapturer, screen, net } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow, createChatWindow } from './app'
import { ShortcutsHelper } from './shortcuts'
import { appState, UIState } from '../state/AppStateMachine'
import { join } from 'path'
import { pathToFileURL } from 'url'

import { GeminiHelper } from '../llm/GeminiHelper'

// On Windows, some graphics drivers can cause rendering issues or log harmless
// warnings about pixel formats. These switches can help mitigate them.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-direct-composition')

// Register custom protocol for assets
function registerResourcesProtocol() {
  protocol.handle('res', async (request) => {
    try {
      const url = new URL(request.url)
      // Combine hostname and pathname to get the full path
      const fullPath = join(url.hostname, url.pathname.slice(1))
      const filePath = join(__dirname, '../../resources', fullPath)
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      console.error('Protocol error:', error)
      return new Response('Resource not found', { status: 404 })
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  // Register custom protocol for assets
  registerResourcesProtocol()
  // Create app window
  const mainWindow = createAppWindow()
  let chatWindow: BrowserWindow | null = null
  const shortcutsHelper = new ShortcutsHelper(mainWindow, () => chatWindow);
  ;(global as any).appState = appState;
  shortcutsHelper.registerGlobalShortcuts();

  const geminiHelper = new GeminiHelper();

  let currentInputValue = '';
  ipcMain.on('input-changed', (_, value) => {

    currentInputValue = value;
  });

  let apiRequestController: AbortController | null = null;

  appState.on('stateChange', async ({ prev, next }) => {
    // Reset chat history when returning to idle
    if (next === UIState.ActiveIdle) {
      geminiHelper.resetChat();
    }


    // Cancel any API request if we are moving away from the Loading state
    if (prev === UIState.Loading && next !== UIState.Loading) {

      apiRequestController?.abort();
      apiRequestController = null;
    }

    // Broadcast the state change to all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('state-changed', { prev, next });
      }
    });

    // --- API Request Management ---
    if (next === UIState.Loading) {
      apiRequestController = new AbortController()
      const { signal } = apiRequestController

      try {
        // --- Capture Phase ---
        // Audio capture is temporarily disabled as it's timing out.
        const audioBase64: string | undefined = undefined;
        // try {
        //   audioFilePath = await captureSystemAudio()
        //   const audioData = await fs.readFile(audioFilePath)
        //   audioBase64 = audioData.toString('base64')
        // } catch (e) {
        //   console.error('[API] Could not capture audio, proceeding without it. Error:', e)
        //   // audioBase64 remains undefined, which is handled by the Gemini helper
        // }

        const primaryDisplay = screen.getPrimaryDisplay()
        const { width, height } = primaryDisplay.size
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width, height }
        })

        const primaryScreenSource =
          sources.find((source) => source.display_id === String(primaryDisplay.id)) || sources[0]

        if (!primaryScreenSource) {
          throw new Error('Could not find primary screen source for screenshot.')
        }

        const screenshotPng = primaryScreenSource.thumbnail.toPNG()

        if (!screenshotPng || screenshotPng.length === 0) {
          console.error('[Screenshot] Failed to capture screenshot, received empty image.')
          throw new Error('Failed to capture screenshot.')
        }

        const screenshotBase64 = screenshotPng.toString('base64')

        // --- API Call Phase ---
        const onChunk = (chunk: string): void => {
          if (!signal.aborted) {
            BrowserWindow.getAllWindows().forEach((win) => {
              if (!win.isDestroyed()) {
                win.webContents.send('api-stream-chunk', chunk)
              }
            })
          }
        }

        await geminiHelper.sendMessageStream(
          currentInputValue,
          onChunk,
          signal,
          screenshotBase64,
          audioBase64 // Pass undefined
        )

        if (!signal.aborted) {
          appState.dispatch('API_SUCCESS')
        }
      } catch (error) {
        if (signal.aborted) {
          console.error('[API] Request was aborted by state change.')
        } else {
          console.error('[API] Request failed:', error)
          const errorMessage =
            error instanceof Error ? error.message : 'An unknown error occurred'
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('api-error', errorMessage)
            }
          })
          appState.dispatch('API_ERROR')
        }
      } finally {
        // if (audioFilePath) {
        //   await cleanupAudioFile(audioFilePath)
        // }
        // Clear the controller reference only if it's the one we created for this request
        if (apiRequestController?.signal === signal) {
          apiRequestController = null
        }
      }
    }
    
    // --- Window Existence Management ---
    const shouldChatWindowExist = [
      UIState.ReadyChat,
      UIState.Loading,
      UIState.Error
    ].includes(next)
    const chatWindowExists = chatWindow && !chatWindow.isDestroyed()

    if (shouldChatWindowExist && !chatWindowExists) {
      chatWindow = createChatWindow()

      // Send the last known input value to the new window
      chatWindow.webContents.on('did-finish-load', () => {
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send('set-initial-input', currentInputValue)
        }
      })

      chatWindow.on('closed', () => {
        chatWindow = null
        // If window is closed manually, it's like pressing ESC
        if (appState.state !== UIState.ActiveIdle) {
          appState.dispatch('ESC')
        }
      })
    } else if (!shouldChatWindowExist && chatWindowExists) {

      if (chatWindow) {
        chatWindow.destroy()
        chatWindow = null
        currentInputValue = '';
      }
    }
  });


  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createAppWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
