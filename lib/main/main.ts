import { app, BrowserWindow, protocol, net } from 'electron'
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
  const shortcutsHelper = new ShortcutsHelper();
  ;(global as any).appState = appState;
  shortcutsHelper.registerGlobalShortcuts();

  appState.on('stateChange', ({ prev, next }) => {
    console.log(`[State] Transition from ${prev} to ${next}`)

    // Broadcast the state change to all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('state-changed', { prev, next })
      }
    })

    // --- Window Existence Management ---
    const shouldChatWindowExist = [
      UIState.ReadyChat,
      UIState.Loading,
      UIState.Error
    ].includes(next)
    const chatWindowExists = chatWindow && !chatWindow.isDestroyed()

    if (shouldChatWindowExist && !chatWindowExists) {
      console.log('[State] Creating chat window')
      chatWindow = createChatWindow()
      chatWindow.on('closed', () => {
        chatWindow = null
        // If window is closed manually, it's like pressing ESC
        if (
          appState.state !== UIState.ActiveIdle &&
          appState.state !== UIState.Hidden
        ) {
          appState.dispatch('ESC')
        }
      })
    } else if (!shouldChatWindowExist && chatWindowExists) {
      console.log('[State] Destroying chat window')
      if (chatWindow) {
        chatWindow.destroy()
        chatWindow = null
      }
    }

    // --- Window Visibility Management ---
    const isAppVisible = next !== UIState.Hidden

    if (isAppVisible) {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
      if (chatWindow && !chatWindow.isDestroyed() && shouldChatWindowExist) {
        chatWindow.show()
        if (next === UIState.ReadyChat) {
          chatWindow.focus()
        }
      }
    } else {
      // Hide everything
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
      if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide()
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
