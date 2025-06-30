import { app, BrowserWindow, ipcMain, protocol, net, screen, desktopCapturer } from 'electron'
import { AudioHelper } from '../audio/AudioHelper'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow, createChatWindow } from './app'
import { ShortcutsHelper } from './shortcuts'
import { appState, UIState } from '../state/AppStateMachine'
import { join } from 'path'
import { pathToFileURL } from 'url'


import { GeminiHelper } from '../llm/GeminiHelper'
import { LiveAudioService } from '../features/live-audio/LiveAudioService'
import { windowRegistry } from './windowRegistry'

// Initialize audio capture functionality before the app is ready.
AudioHelper.initialize();

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
  let isInvisible = false;
  let mainWindow = createAppWindow(isInvisible);
  windowRegistry.setMainWindow(mainWindow);

  // Expose current invisibility state to renderer processes
  ipcMain.handle('get-invisibility-state', () => isInvisible);

  // Send initial state to the freshly created window once it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('invisibility-state-changed', isInvisible);
    }
  });
  let chatWindow: BrowserWindow | null = null;
  windowRegistry.setChatWindow(chatWindow);
  const shortcutsHelper = new ShortcutsHelper(mainWindow, () => chatWindow);

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  ipcMain.on('toggle-invisibility', () => {
    isInvisible = !isInvisible;

    // Close existing windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.close();
    }

    // Recreate windows with the new setting
    mainWindow = createAppWindow(isInvisible);
    windowRegistry.setMainWindow(mainWindow);
    shortcutsHelper.updateMainWindow(mainWindow);
    mainWindow.webContents.on('did-finish-load', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('invisibility-state-changed', isInvisible);
      }
    });

    // Notify all existing windows (if any) about the state change
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('invisibility-state-changed', isInvisible);
      }
    });

    // The chat window will be recreated by the state machine if needed
  });
  ;(global as any).appState = appState;
  shortcutsHelper.registerGlobalShortcuts();

  const geminiHelper = new GeminiHelper();

  let currentInputValue = '';
  ipcMain.on('input-changed', (_, value) => {

    currentInputValue = value;
});

// Renderer requests to open chat via main bar
ipcMain.on('open-chat', () => {
  appState.dispatch('OPEN_CHAT');
  });

  // ---- Gemini Live Audio IPC wiring ----
  const liveAudioService = new LiveAudioService();

  let isLiveAudioActive = false;

  ipcMain.on('live-audio-start', async () => {
    console.warn('Received live-audio-start event.');
    if (isLiveAudioActive) {
      console.warn('Live audio already active, ignoring start event.');
      return;
    }

    try {
      // Start both helpers and wait for their connections to open
      await liveAudioService.start({
        onGeminiChunk: (chunk) => {
          if (chunk.text) console.warn('[Gemini]', chunk.text);
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('gemini-transcript', chunk);
          }
        },
        onTranscript: (text) => {
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('live-transcript', text);
          }
        }
      });

      console.warn('Both Gemini and Deepgram connections are open. Ready to send audio.');
      isLiveAudioActive = true;
    } catch (error) {
      console.error('Failed to start live audio services:', error);
      // Optionally, send an error back to the renderer
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win.isDestroyed()) return;
        win.webContents.send('live-audio-error', 'Failed to start audio services.');
      });
      isLiveAudioActive = false;
      return;
    }
  });

  ipcMain.on('live-audio-chunk', (_event, chunk: Uint8Array) => {
    if (!isLiveAudioActive) {
      console.warn('Live audio not active, dropping audio chunk.');
      return;
    }
    const audioBuffer = Buffer.from(chunk);
    liveAudioService.sendAudioChunk(audioBuffer);
  });

  ipcMain.on('live-audio-stop', () => {
    console.warn('Received live-audio-stop event.');
    if (!isLiveAudioActive) {
      console.warn('Live audio not active, ignoring stop event.');
      return;
    }
    liveAudioService.stop();
    isLiveAudioActive = false;
  });

  ipcMain.on('live-audio-done', () => {
    liveAudioService.finishTurn();
  });

  ipcMain.on('live-image-chunk', (_, jpegBase64: string) => {
    liveAudioService.sendImageChunk(jpegBase64);
  });

  let apiRequestController: AbortController | null = null;

  appState.on('stateChange', async ({ prev, next }) => {
    // If a live session is active and user submits text -> send via live session.
    if (next === UIState.Loading) {
      if (liveAudioService.isActive()) {
      if (currentInputValue.trim()) {
        liveAudioService.sendTextInput(currentInputValue.trim());
      }
      // Short-circuit normal loading flow; mark immediate success so UI resets.
      appState.dispatch('API_SUCCESS');
      return;
    } else {
      // Proceed with normal chat flow (existing logic)
    }
    }
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
        const primaryDisplay = screen.getPrimaryDisplay()
                const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: primaryDisplay.size })
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
                win.webContents.send('api-stream-chunk', { text: chunk })
              }
            })
          }
        }

        await geminiHelper.sendMessageStream(
          currentInputValue,
          onChunk,
          signal,
          screenshotBase64,
          undefined // Audio is now handled separately
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
      chatWindow = createChatWindow(isInvisible);
      windowRegistry.setChatWindow(chatWindow);

      // Send the last known input value to the new window
      chatWindow.webContents.on('did-finish-load', () => {
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send('set-initial-input', currentInputValue)
        }
      })

      chatWindow.on('closed', () => {
        chatWindow = null;
        windowRegistry.setChatWindow(null)
        // If window is closed manually, it's like pressing ESC
        if (appState.state !== UIState.ActiveIdle) {
          appState.dispatch('ESC')
        }
      })
    } else if (!shouldChatWindowExist && chatWindowExists) {

      if (chatWindow) {
        chatWindow.destroy()
        chatWindow = null;
        windowRegistry.setChatWindow(null)
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
