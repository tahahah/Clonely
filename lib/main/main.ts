import { app, BrowserWindow, protocol, net, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow, createChatWindow } from './app'
import { ShortcutsHelper } from './shortcuts'
import { appState, UIState } from '../state/AppStateMachine'
import { join } from 'path'
import { pathToFileURL } from 'url'

// Optional: Enables GPU acceleration for transparent windows on Windows
// app.commandLine.appendSwitch('enable-transparent-visuals')

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32' && !app.isPackaged) {
  app.disableHardwareAcceleration()
}

app.disableHardwareAcceleration();

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

  let currentInputValue = '';
  ipcMain.on('input-changed', (_, value) => {

    currentInputValue = value;
  });

  let apiRequestController: AbortController | null = null;

  appState.on('stateChange', async ({ prev, next }) => {


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
      apiRequestController = new AbortController();
      const { signal } = apiRequestController;


      try {
        // Simulate a cancellable API call
        const result = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(`This is the AI answer for: ${currentInputValue}`), 3000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });


        if (!signal.aborted) {
          // Send result to the UI before transitioning state
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('api-result', result);
            }
          });
          appState.dispatch('API_SUCCESS');
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Request was aborted, do nothing.
        } else {
          console.error('[API] Request failed:', error);
          // Send error details to the UI
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('api-error', errorMessage);
            }
          });
          appState.dispatch('API_ERROR');
        }
      } finally {
        // Ensure the controller is cleaned up
        if (apiRequestController?.signal === signal) {
          apiRequestController = null;
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
